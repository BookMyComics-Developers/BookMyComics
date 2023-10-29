//use actix::prelude::*;

use actix::{Message, MessageResponse};

// use serde_json::Value;
use serde::{Deserialize, Serialize};

// use crate::models;

//
// Used to send actual data to Sessions
#[derive(Message)]
#[rtype(result = "()")]
pub struct WsMessage(pub String);

/****************************************
 *                                      *
 *       Data management messages       *
 *                                      *
 ***************************************/
/*
 * Notes:
 *
 * About referencing comics/readers:
 * - Comics are externally referred-to by their unique labels
 * - Sources/Readers are externally referred-to by the unique name (per Comic)
 * Hence, we do not externally provide an ID, but instead use the names a publicly unique
 * identifiers
 *
 */
#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct TrackReader {
    pub comic_label: String,
    pub name: String,
    pub has_update: bool,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct UpdateReader {
    pub comic_label: String,
    pub name: String,
    pub has_update: bool,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct UntrackReader {
    pub comic_label: String,
    pub name: String,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct TrackComic {
    pub label: String,
    pub chapter: i32,
    pub page: Option<i32>,
    pub source: TrackReader,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct UpdateComic {
    pub label: String,
    pub chapter: i32,
    pub page: Option<i32>,
    pub readers: Vec<UpdateReader>,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct UntrackComic {
    pub label: String,
}

/*******************************
 *                             *
 *     Data access messages    *
 *                             *
 *******************************/
/*
 * FIXME: To be replaced by DB Models ?
 */
#[derive(Debug, Serialize, Deserialize)]
pub struct Comic {
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComicSource {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComicEntry {
    pub comic: Comic,
    pub sources: Vec<ComicSource>,
}

#[derive(Debug, MessageResponse, Serialize, Deserialize)]
pub struct ComicListing {
    pub comics: Vec<ComicEntry>,
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "ComicListing")]
pub struct ListComics {}

/*
 * Generic Message wrapper for all client-received  messages.
 */
#[derive(Debug, Serialize, Deserialize)]
pub enum MessagePayload {
    TrackReader(TrackReader),
    UpdateReader(UpdateReader),
    UntrackReader(UntrackReader),
    TrackComic(TrackComic),
    UpdateComic(UpdateComic),
    UntrackComic(UntrackComic),
    ListComics(ListComics),
}

#[derive(Debug, Message, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct BmcMessage {
    pub client_id: String,
    pub ws_id: i64,
    #[serde(flatten)]
    pub payload: MessagePayload,
}

/****************************************
 *                                      *
 *   Unsollicited notification messages *
 *                                      *
 ***************************************/
