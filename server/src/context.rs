use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use unique_id::Generator;
use unique_id::sequence::SequenceGenerator;

use crate::client::Client;


// The server may have multiple active Clients
pub struct ServerContext {
    id_generator: SequenceGenerator,
    clients: Mutex<HashMap<String, Arc<Mutex<Client>>>>,
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
    pub fn ensure_client(&self, client_id: &String) -> Arc<Mutex<Client>> {
        let mut clients = self.clients.lock().unwrap();
        if let Some(client) = clients.get(&client_id.to_string()) {
            return client.clone();
        }
        let client = Arc::new(
            Mutex::<Client>::new(Client::new(client_id.to_string()))
        );
        clients.insert(client_id.to_string(), client);
        clients.get(client_id).unwrap().clone()
    }

    pub fn remove_client(&self, client_id: &str) {
        let mut clients = self.clients.lock().unwrap();
        if let Some(_) = clients.get(client_id) {
            clients.remove(client_id);
            return;
        }
        log::error!("Attempted to remove invalid client({:?})", client_id);
    }
}

