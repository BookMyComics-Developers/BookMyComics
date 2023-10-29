use std::collections::HashMap;
use std::sync::Mutex;

use actix::{Actor, Context, Handler, Message};

use crate::session::WsSessionHolder;
use crate::messages::*;


#[derive(Debug, Message)]
#[rtype(result = "bool")]
pub struct Register {
    pub holder: WsSessionHolder,
}

#[derive(Debug, Message)]
#[rtype(result = "bool")]
pub struct Unregister {
    pub id: i64,
}


pub struct Client {
    pub id: String,
    // One client may have multiple active web-socket sessions
    // Used to:
    // - Notify all sessions of a data update
    // - Invalidate all other sessions in case of credentials update
    sessions: Mutex<HashMap<i64, WsSessionHolder>>,
}

impl Client {
    pub fn new(id: String) -> Client {
        Client {
            id: id,
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn add_session(&mut self, session: WsSessionHolder) -> bool {
        if let Ok(sess) = self.sessions.lock() {
            if sess.contains_key(&session.id) {
                log::error!("Cannot add session for client {:?}: Already present in internal vector", self.id);
                return false;
            } else {
                sess.insert(session.id, session);
                return true;
            }
        } else {
            log::error!("Cannot add session for client {:?}: Already present in internal vector", self.id);
            return false;
        }
    }

    pub fn remove_session(&mut self, session_id: &i64) {
        if let Ok(sess) = self.sessions.lock() {
            if !sess.contains_key(&session_id) {
                log::error!("Could not remove session for client {:?}: Not present in internal vector", self.id);
            } else {
                sess.remove(&session_id);
                return ;
            }
        }
        log::error!("Could not lock sessions remove {:?}", &session_id);
    }

    pub fn empty(&self) -> bool {
        if let Ok(sess) = self.sessions.lock() {
            return sess.len() == 0;
        }
        log::error!("Could not lock sessions to check if Client is empty");
        return false;
    }
}

impl Actor for Client {
    type Context = Context<Self>;
}

impl Handler<Register> for Client {
    type Result = bool;
    fn handle(&mut self, msg: Register, _: &mut Context<Self>) -> bool {
        println!("Client {:?}: Handling Register: session={:?}",
                 self.id, &msg.holder.id);
        return self.add_session(msg.holder);
    }
}

impl Handler<Unregister> for Client {
    type Result = bool;
    fn handle(&mut self, msg: Unregister, _: &mut Context<Self>) -> bool {
        println!("Client {:?}: Handling Unregister: {:?}",
                 self.id, &msg.id);
        self.remove_session(&msg.id);
        return self.empty();
    }
}

impl Handler<TrackReader> for Client {
    type Result = ();
    fn handle(&mut self, msg: TrackReader, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling TrackReader: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<UpdateReader> for Client {
    type Result = ();
    fn handle(&mut self, msg: UpdateReader, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling UpdateReader: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<UntrackReader> for Client {
    type Result = ();
    fn handle(&mut self, msg: UntrackReader, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling UntrackReader: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<TrackComic> for Client {
    type Result = ();
    fn handle(&mut self, msg: TrackComic, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling TrackComic: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<UpdateComic> for Client {
    type Result = ();
    fn handle(&mut self, msg: UpdateComic, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling UpdateComic: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<UntrackComic> for Client {
    type Result = ();
    fn handle(&mut self, msg: UntrackComic, _: &mut Context<Self>) {
        println!(
            "Client {:?}: Handling UntrackComic: {:?}",
            self.id, serde_json::to_string(&msg)
        );
    }
}

impl Handler<ListComics> for Client {
    type Result = ComicListing;
    fn handle(&mut self, msg: ListComics, _: &mut Context<Self>) -> ComicListing {
        println!(
            "Client {:?}: Handling ListComics: {:?}",
            self.id, serde_json::to_string(&msg)
        );
        ComicListing {
            comics: Vec::new(),
        }
    }
}
