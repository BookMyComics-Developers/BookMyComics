use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::result::Result::{Err, Ok};
use std::sync::Mutex;

use unique_id::sequence::SequenceGenerator;
use unique_id::Generator;

use actix::{
    Actor, ActorFutureExt, Addr, Context, ContextFutureSpawner, Handler, Message, WrapFuture,
};

use crate::client;
use crate::client::Client;
use crate::messages::*;
use crate::session::{WsSession, WsSessionHolder};

#[derive(Debug, Message)]
#[rtype(i64)]
pub struct RegisterSession {
    pub client_id: String,
    pub addr: Addr<WsSession>,
}

#[derive(Debug, Message)]
#[rtype(result = "Option<Addr<Client>>")]
pub struct GetClient {
    pub client_id: String,
}

#[derive(Debug, Message)]
#[rtype(result = "()")]
pub struct UnregisterSession {
    pub id: i64,
    pub client_id: String,
}

// The server may have multiple active Clients
pub struct ServerContext {
    id_generator: SequenceGenerator,
    clients: Mutex<HashMap<String, Addr<Client>>>,
}

impl ServerContext {
    pub fn new() -> ServerContext {
        ServerContext {
            id_generator: SequenceGenerator::default(),
            clients: Mutex::new(HashMap::new()),
        }
    }

    pub fn next_id(&self) -> i64 {
        self.id_generator.next_id()
    }

    /*
     *FIXME:
     * We might have concurrency issue, as we can 'contain' a client with an empty hashmap of
     * sessions; meaning that it may be cleaned-up meanwhile (Risk is low, but still)
     */
    pub fn ensure_client(&self, client_id: &String) -> Option<Addr<Client>> {
        let mut clients = self.clients.lock().unwrap();
        if let Some(client) = clients.get(&client_id.to_string()) {
            return Some(client.clone());
        }
        let client_addr = Client::new(client_id.to_string()).start();
        clients.insert(client_id.to_string(), client_addr);
        Some(clients.get(client_id).unwrap().clone())
    }

    pub fn get_client(&self, client_id: &String) -> Option<Addr<Client>> {
        if let Ok(mut clnts) = self.clients.lock() {
            if let Some(client) = clnts.get(client_id) {
                return Some(client.clone());
            } else {
                log::error!("Attempted to get invalid client({:?})", client_id);
            }
        } else {
            log::error!(
                "Failed to lock clients collection for client({:?})",
                client_id
            );
        }
        None
    }

    pub fn remove_client_session(&self, client_id: &str, session_id: i64) {
        let mut clients = self.clients.lock().unwrap();
        if let Some(client) = clients.get(client_id) {
            if let removable = client.send(client::Unregister { id: session_id }) {
                clients.remove(client_id);
            }
            return;
        }
        log::error!("Attempted to remove invalid client({:?})", client_id);
    }
}

impl Actor for ServerContext {
    type Context = Context<Self>;
}

impl Handler<RegisterSession> for ServerContext {
    type Result = i64;

    fn handle(&mut self, msg: RegisterSession, ctx: &mut Context<Self>) -> Self::Result {
        if let Some(client) = self.ensure_client(&msg.client_id) {
            let session_id = Rc::new(RefCell::new(self.next_id()));
            let r_session_id = Rc::clone(&session_id);
            client
                .send(client::Register {
                    holder: WsSessionHolder {
                        id: *session_id.borrow(),
                        addr: msg.addr,
                    },
                })
                .into_actor(self)
                .then(move |res, act, _ctx| {
                    match res {
                        Ok(success) => {
                            if success {
                                return actix::prelude::fut::ready(());
                            }
                            log::error!(
                                "Failed to register session {:?} into client({:?})",
                                *r_session_id.borrow(),
                                &msg.client_id
                            );
                        }
                        Err(e) => {
                            log::error!("Failed to receive answer from client Actor: {:?}", e);
                        }
                    }
                    *r_session_id.borrow_mut() = -1;
                    actix::prelude::fut::ready(())
                })
                .wait(ctx);
            let x: Self::Result = *session_id.borrow();
            x
        } else {
            -1
        }
    }
}

impl Handler<GetClient> for ServerContext {
    type Result = Option<Addr<Client>>;

    fn handle(&mut self, msg: GetClient, _: &mut Context<Self>) -> Option<Addr<Client>> {
        if let Some(client) = self.get_client(&msg.client_id) {
            return Some(client.clone());
        }
        None
    }
}

impl Handler<UnregisterSession> for ServerContext {
    type Result = ();

    fn handle(&mut self, msg: UnregisterSession, _: &mut Context<Self>) {
        if let Some(client) = self.get_client(&msg.client_id) {
            client.send(client::Unregister { id: msg.id });
        }
    }
}

impl Handler<BmcMessage> for ServerContext {
    type Result = ();

    fn handle(&mut self, msg: BmcMessage, _: &mut Context<Self>) {
        println!(
            "ServerContext: Processing BmcMessages for {:?}/{:?}",
            &msg.client_id, &msg.ws_id
        );
        if let Ok(clients) = self.clients.lock() {
            if let Some(client) = clients.get(&msg.client_id) {
                match msg.payload {
                    MessagePayload::TrackReader(pld) => client.do_send(pld),
                    MessagePayload::UpdateReader(pld) => client.do_send(pld),
                    MessagePayload::UntrackReader(pld) => client.do_send(pld),
                    MessagePayload::TrackComic(pld) => client.do_send(pld),
                    MessagePayload::UpdateComic(pld) => client.do_send(pld),
                    MessagePayload::UntrackComic(pld) => client.do_send(pld),
                    MessagePayload::ListComics(pld) => client.do_send(pld),
                }
            } else {
                println!("Unable to get client for id {:?} ?", &msg.client_id);
            }
        } else {
            println!("Unable to lock clients collection ?");
        }
    }
}
