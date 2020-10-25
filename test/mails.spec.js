"use strict";

const { ServiceBroker } = require("moleculer");
const { Mails } = require("../index");
const { AclMixin } = require("imicros-acl");
const { SecretsMixin } = require("imicros-minio");
const { v4: uuid } = require("uuid");
const nodemailer = require("nodemailer");
const fs = require("fs");
const util = require("util");

const timestamp = Date.now();

const globalStore ={};

// mock imicros-minio mixin
const Store = (/*options*/) => { return {
    methods: {
        async putObject ({ ctx = null, objectName = null, value = null } = {}) {
            if ( !ctx || !objectName ) return false;
            
            let internal = Buffer.from(ctx.meta.acl.ownerId + "~" + objectName).toString("base64");
            
            this.store[internal] = value;
            return true;
        },
        async getObject ({ ctx = null, objectName }) {
            if ( !ctx || !objectName ) throw new Error("missing parameter");

            let internal = Buffer.from(ctx.meta.acl.ownerId + "~" + objectName).toString("base64");
            
            return this.store[internal];            
        }   
    },
    created () {
        this.store = globalStore;
    }
};};


// mock keys service
const Keys = {
    name: "keys",
    actions: {
        getOek: {
            handler(ctx) {
                if (!ctx.params || !ctx.params.service) throw new Error("Missing service name");
                if ( ctx.params.id == "prev" ) {
                    return {
                        id: this.prev,
                        key: "myPreviousSecret"
                    };    
                }
                return {
                    id: this.current,
                    key: "mySecret"
                };
            }
        }
    },
    created() {
        this.prev = uuid();
        this.current = uuid();
    } 
};

describe("Test mails service", () => {

    let broker, service, account, keyService;
    beforeAll(async () => {
        account = await nodemailer.createTestAccount();
        console.log(account);
    });
    
    afterAll(() => {
    });
    
    describe("Test create service", () => {

        it("it should start the broker", async () => {
            broker = new ServiceBroker({
                logger: {
                    type: "Pino",
                    options: {
                        level: "error",
                        pino: {
                            options: null
                        }
                    }
                } //,
                // logLevel: "debug" // "info" //"debug"
            });
            keyService = await broker.createService(Keys);
            service = await broker.createService(Mails, Object.assign({ 
                name: "mails",
                mixins: [Store(), AclMixin, SecretsMixin({ service: "keys" })],
                dependencies: ["keys"]
            }));
            await broker.start();
            expect(keyService).toBeDefined();
            expect(service).toBeDefined();
        });

    });
    
    describe("Test send mail via smtp", () => {

        let opts;
        
        beforeEach(() => {
            opts = { 
                meta: { 
                    acl: {
                        accessToken: "this is the access token",
                        ownerId: `g1-${timestamp}`,
                        unrestricted: true
                    }, 
                    user: { 
                        id: `1-${timestamp}` , 
                        email: `1-${timestamp}@host.com`
                    }
                } 
            };
        });        

        it("it should save imap settings", async () => {
            let params = {
                account: "test.imap",
                settings: {
                    imap: {
                        host: account.imap.host,
                        port: account.imap.port,
                        tls: true
                    },
                    auth: {
                        user: account.user,
                        pass: {
                            _encrypt: {
                                value: account.pass
                            }
                        }
                    }
                }
            };
            return broker.call("mails.imap", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.account).toBeDefined();
            });
                
        });
        
        it("it should verify the account", async () => {
            let params = {
                account: "test.imap"
            };
            return broker.call("mails.verify", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.test).toEqual(true);
                expect(res.err).toEqual(null);
            });
                
        });

        it("it should reject verification of the account", async () => {
            let params = {
                account: {
                    imap: {
                        host: account.imap.host,
                        port: account.imap.port,
                        tls: true,
                        authTimeout: 1000
                    },
                    auth: {
                        user: account.user,
                        pass: "wrong pass"
                    }
                }
            };
            return broker.call("mails.verify", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.test).toEqual(false);
                expect(res.err).toBeDefined();
                // console.log(res.err);
                // console.log(res.err.message);
            });
                
        },2000);

        it("it should fetch sent email via imap", async () => {
            let params = {
                account: "test.imap",
                seq: 1
            };
            return broker.call("mails.fetch", params, opts).then(res => {
                expect(res).toBeDefined();
                console.log(util.inspect(res, false, 10));
            });
                
        });
        
        
    });
        
    describe("Test stop broker", () => {
        it("should stop the broker", async () => {
            expect.assertions(1);
            await broker.stop();
            expect(broker).toBeDefined();
        });
    });    
    
});