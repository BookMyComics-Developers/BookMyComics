use std::collections::HashMap;

use crate::session::WsSessionHolder;

pub struct Client {
    pub id: String,
    // One client may have multiple active web-socket sessions
    // Used to:
    // - Notify all sessions of a data update
    // - Invalidate all other sessions in case of credentials update
    sessions: HashMap<i64, WsSessionHolder>,
}

impl Client {
    pub fn new(id: String) -> Client {
        Client {
            id: id,
            sessions: HashMap::new(),
        }
    }

    pub fn add_session(&mut self, session: WsSessionHolder) {
        if self.sessions.contains_key(&session.id) {
            log::error!("Cannot add session for client {:?}: Already present in internal vector", self.id);
        } else {
            self.sessions.insert(session.id, session);
        }
    }

    pub fn remove_session(&mut self, session_id: &i64) {
        if !self.sessions.contains_key(&session_id) {
            log::error!("Could not remove session for client {:?}: Not present in internal vector", self.id);
        } else {
            self.sessions.remove(&session_id);
        }
    }

    pub fn empty(&self) -> bool {
        self.sessions.len() == 0
    }
}

