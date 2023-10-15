use std::sync::Mutex;

use actix::{Actor, ActorContext, StreamHandler};
use actix_web::middleware::Logger;
use actix_web::{
    get, post, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder, Result, guard, http::KeepAlive
};
use actix_web_actors::ws;
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod};

struct WsSession;

/*
impl Drop for WsSession {
    fn drop(&mut self) {
        self.client.unregister(self);
    }
}
*/

struct WsSessionHolder<'client> {
    session: WsSession,
    client: &'client Client<'client>,
}

struct Client<'client> {
    pub id: String,
    // One client may have multiple active web-socket sessions
    // Used to:
    // - Notify all sessions of a data update
    // - Invalidate all other sessions in case of credentials update
    sessions: Mutex<Vec<WsSessionHolder<'client>>>,
}

// The server may have multiple active Clients
struct ServerContext<'server> {
    clients: Mutex<Vec<Client<'server>>>,
}

impl<'srv> ServerContext<'srv> {
    fn inserted_client<'client>(&self, client_id: &str, clients: &'srv mut Vec::<Client<'client>>) -> &Client<'client> {
        let client = Client{id: String{vec: client_id.into()}, sessions: Mutex::new(Vec::<WsSessionHolder>::new())};
        clients.push(client);
        return clients.last().unwrap();
    }

    fn ensure_client(&self, client_id: &str) -> &Client {
        let mut clients = self.clients.lock().unwrap();
        if let Some(client) = clients.iter_mut().find(|&client| client.id == client_id) {
            return client;
        }
        return self.inserted_client(&client_id, &mut clients);
    }

    // fn remove_client(&self, client: Client) {
    //     let mut clients = self.clients.lock().unwrap();
    //     if let Some(idx) = clients.iter().position(|&item| item.id == client.id) {
    //         clients.remove(idx);
    //         return;
    //     }
    //     log::error!("Attempted to remove invalid client({:?})", client.id);
    // }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;
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
            _ => ctx.stop(),
        }
    }
}

#[post("/login")]
async fn ws_login(ctx: web::Data<ServerContext<'_>>, req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    log::info!("Requested Health route");
    let client = ctx.ensure_client(&"test");
    let holder = WsSessionHolder{session: WsSession{}, client: &client};
    //client.add_session(holder);
    ws::start(holder.session, &req, stream)
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
        clients: Mutex::new(Vec::<Client>::new()),
    });
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    HttpServer::new(move ||
            //create_app!(srvCtx)
            App::new()
                .app_data(server_context.clone())
                .service(
                    web::scope("/")
                    // TODO/FIXME: Make host configurable
                    //.guard(guard::Host("bmc.joacchim.fr"))
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
