use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use unique_id::Generator;
use unique_id::sequence::SequenceGenerator;

use actix::prelude::{Message,Running};
use actix::{Actor, ActorContext, StreamHandler, AsyncContext, Addr};
use actix_web::middleware::Logger;
use actix_web::{
    get, post, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder, Result, guard, http::KeepAlive
};
use actix_web_actors::ws;
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod};


// All messages should derive this
#[derive(Message)]
#[rtype(result = "()")]   // from actix/examples:master:websockets/chat/src/server.rs
pub struct BmcMessage;


struct WsSession {
    pub id: i64,
    pub client_id: String,
    pub hb: Instant,
    srv: web::Data<ServerContext>,
}

struct WsSessionHolder {
    pub id: i64,
    addr: Addr<WsSession>,
}

struct Client {
    pub id: String,
    // One client may have multiple active web-socket sessions
    // Used to:
    // - Notify all sessions of a data update
    // - Invalidate all other sessions in case of credentials update
    sessions: HashMap<i64, WsSessionHolder>,
}

impl Client {
    fn add_session(&mut self, session: WsSessionHolder) {
        if self.sessions.contains_key(&session.id) {
            log::error!("Cannot add session for client {:?}: Already present in internal vector", self.id);
        } else {
            self.sessions.insert(session.id, session);
        }
    }

    fn remove_session(&mut self, session_id: &i64) {
        if !self.sessions.contains_key(&session_id) {
            log::error!("Could not remove session for client {:?}: Not present in internal vector", self.id);
        } else {
            self.sessions.remove(&session_id);
        }
    }

    fn empty(&self) -> bool {
        self.sessions.len() == 0
    }
}

// The server may have multiple active Clients
struct ServerContext {
    id_generator: SequenceGenerator,
    clients: Mutex<HashMap<String, Arc<Mutex<Client>>>>,
}

impl ServerContext {
    /*
     *FIXME:
     * We might have concurrency issue, as we can 'contain' a client with an empty hashmap of
     * sessions; meaning that it may be cleaned-up meanwhile (Risk is low, but still)
     */
    fn ensure_client(&self, client_id: &String) -> Arc<Mutex<Client>> {
        let mut clients = self.clients.lock().unwrap();
        if let Some(client) = clients.get(&client_id.to_string()) {
            return client.clone();
        }
        let client = Arc::new(
            Mutex::<Client>::new(Client {
                id: client_id.to_string(),
                sessions: HashMap::new()
            })
        );
        clients.insert(client_id.to_string(), client);
        clients.get(client_id).unwrap().clone()
    }

    fn remove_client(&self, client_id: &str) {
        let mut clients = self.clients.lock().unwrap();
        if let Some(_) = clients.get(client_id) {
            clients.remove(client_id);
            return;
        }
        log::error!("Attempted to remove invalid client({:?})", client_id);
    }
}

// Heartbeat every 5 secs.
// Consider timed-out after more than twice the HeartBeat
const HEARTBEAT_PERIOD: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration =  Duration::from_secs(10);

impl WsSession {
    fn register(&self, addr: Addr<WsSession>) {
        let shared_client = self.srv.ensure_client(&self.client_id);
        if let Ok(mut client) = shared_client.lock() {
            client.add_session(WsSessionHolder {
                id: self.id,
                addr: addr,
            });
        };
    }

    fn unregister(&self) {
        let shared_client = self.srv.ensure_client(&self.client_id);
        if let Ok(mut client) = shared_client.lock() {
            client.remove_session(&self.id);
            if ! client.empty() {
                return
            }
        }
        self.srv.remove_client(&self.client_id);
    }

    // Sends heartbeats to client at regular intervals
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_PERIOD, |act, ctx| {
            // Check
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // heartbeat timed out
                log::debug!("Client timed-out for {:?}({:?})", act.client_id, act.id);

                // Seems to be a different mechanism than Actor's lifecycle control?
                // examples seem to consider so; So we also unregister here too
                act.unregister();

                ctx.stop();
                return;
            }

            ctx.ping(b"");
        });
    }
}

// Controls the actual lifecycle of the WebSocket
impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        self.register(ctx.address());
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        self.unregister();
        Running::Stop
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        log::info!("WsSession: Received message {:?}", msg);
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                // Process DB Requests here
                ctx.text(text)
            },
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => {
                ctx.stop();
            },
        }
    }
}

#[post("/login")]
async fn ws_login(ctx: web::Data<ServerContext>, req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    log::info!("Requested Login route");
    ws::start(WsSession {
        id: ctx.id_generator.next_id(),
        client_id: "test".to_string(),
        hb: Instant::now(),
        srv: ctx.clone(),
    }, &req, stream)
}

#[get("/")]
async fn health() -> impl Responder {
    log::info!("Requested Health route");
    HttpResponse::Ok().body("Alive")
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // NOTE: Generate a self-signed temporary cert for testing via:
    // `openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365 -subj '/CN=localhost'`
    let mut ssl_ctx = SslAcceptor::mozilla_intermediate(SslMethod::tls()).unwrap();
    // Load the TLS keys for your deployment:
    // TODO/FIXME: Make path configurable
    ssl_ctx.set_private_key_file("key.pem", SslFiletype::PEM).unwrap();
    ssl_ctx.set_certificate_chain_file("cert.pem").unwrap();

    let server_context = web::Data::new(ServerContext {
        id_generator: SequenceGenerator::default(),
        clients: Mutex::new(HashMap::new()),
    });
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    HttpServer::new(move ||
            //create_app!(srvCtx)
            App::new()
                .app_data(server_context.clone())
                .service(
                    web::scope("/")
                    // TODO/FIXME: Make host configurable
                    .guard(guard::Host("bmc.joacchim.fr"))
                    .service(
                        web::scope("/v1")
                            .service(health)
                            .service(ws_login)
                    )
                )
                .wrap(Logger::default())
        )
        .keep_alive(KeepAlive::Os)
        .bind_openssl("127.0.0.1:8443", ssl_ctx)?
        .run()
        .await
}
