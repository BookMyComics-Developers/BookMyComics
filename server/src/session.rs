use std::time::{Duration, Instant};

use actix::prelude::{Running};
use actix::{Actor, ActorContext, AsyncContext, StreamHandler, Addr};

use actix_web::{web, Result};
use actix_web_actors::ws;

use crate::context::ServerContext;


pub struct WsSession {
    pub id: i64,
    pub client_id: String,
    pub hb: Instant,
    pub srv: web::Data<ServerContext>,
}

pub struct WsSessionHolder {
    pub id: i64,
    addr: Addr<WsSession>,
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

