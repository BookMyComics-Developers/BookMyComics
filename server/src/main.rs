use std::time::Instant;

use actix_web::middleware::Logger;
use actix_web::{
    get, post, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder, Result, guard, http::KeepAlive
};
use actix_web_actors::ws;
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod};

use bookmaker::{
    session::WsSession, context::ServerContext
};

#[post("/login")]
async fn ws_login(ctx: web::Data<ServerContext>, req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    log::info!("Requested Login route");
    ws::start(WsSession {
        id: ctx.next_id(),
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

    let ctx = web::Data::new(ServerContext::new());
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    HttpServer::new(move ||
            //create_app!(srvCtx)
            App::new()
                .app_data(ctx.clone())
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
        // TODO/FIXME: Make listen/bind configurable
        .bind_openssl("127.0.0.1:8443", ssl_ctx)?
        .run()
        .await
}
