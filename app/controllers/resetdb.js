var db = new Mongo().getDB('mean-dev');

db.handids.drop();
db.handhistories.drop();
db.rakeaccountings.drop();
db.singlegameevents.drop();
