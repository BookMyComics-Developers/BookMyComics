use std::time::{Duration, Instant};

use serde_json;

use actix::prelude::Running;
use actix::{
    Actor, ActorContext, ActorFutureExt, Addr, AsyncContext, ContextFutureSpawner, Handler,
    StreamHandler, WrapFuture,
};

use actix_web::{web, Result};
use actix_web_actors::ws;
use actix_ws::{CloseCode, CloseReason};

use crate::context::{RegisterSession, ServerContext, UnregisterSession};
use crate::messages::*;

pub struct WsSession {
    pub id: i64,
    pub client_id: String,
    pub hb: Instant,
    pub srv: web::Data<Addr<ServerContext>>,
}

#[derive(Debug)]
pub struct WsSessionHolder {
    pub id: i64,
    pub addr: Addr<WsSession>,
}

// Heartbeat every 5 secs.
// Consider timed-out after more than twice the HeartBeat
const HEARTBEAT_PERIOD: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

impl WsSession {
    fn unregister(&self, ctx: &mut ws::WebsocketContext<Self>) {
        self.srv.do_send(UnregisterSession {
            id: self.id,
            client_id: self.client_id.to_string(),
        });
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
                act.unregister(ctx);

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

        self.srv
            .send(RegisterSession {
                client_id: self.client_id.to_string(),
                addr: ctx.address(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(id) => {
                        act.id = id;
                    }
                    Err(e) => {
                        log::error!("Failed to register session. Forcefully closing Websocket");
                        ctx.close(Some(CloseReason {
                            code: CloseCode::Error,
                            description: Some("Unable to register session internally".to_string()),
                        }));
                        ctx.stop();
                    }
                }
                actix::prelude::fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, ctx: &mut Self::Context) -> Running {
        self.unregister(ctx);
        Running::Stop
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        log::info!("WsSession: Received message {:?}", msg);
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                if let Ok(json) = serde_json::from_str(&text) {
                    // Process DB Requests here
                    self.srv.send(BmcMessage {
                        client_id: self.client_id.clone(),
                        ws_id: self.id,
                        payload: json,
                    });
                } else {
                    println!("Could not unserialize message {:?}", text);
                }
            }
            Ok(ws::Message::Binary(bin)) => ctx.binary(bin),
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => {
                ctx.stop();
            }
        }
    }
}

impl Handler<WsMessage> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: WsMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl Actor for WsSessionHolder {
    type Context = ws::WebsocketContext<Self>;
}
