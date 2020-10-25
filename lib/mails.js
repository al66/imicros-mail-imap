/**
 * @license MIT, imicros.de (c) 2019 Andreas Leinen
 */
"use strict";

const _ = require("lodash");
const Imap = require("imap");
const util = require("util");

/** Actions */
// action imap { account, settings } => boolean
// action verify { account} => boolean
// action fetch { account, message } => boolean

module.exports = {
    name: "mails",
    
    /**
     * Service settings
     */
    settings: {},

    /**
     * Service metadata
     */
    metadata: {},

    /**
     * Service dependencies
     */
    //dependencies: [],	

    /**
     * Actions
     */
    actions: {

        /**
         * save imap settings
         * 
         * @actions
         * @param {String} account
         * @param {Object} settings
         * 
         * @returns {Object} account
         */
        imap: {
            acl: "before",
            params: {
                account: { type: "string" },
                settings: { type: "object" }
            },			
            async handler(ctx) {
                let name = ctx.params.account;
                let account = {};
                try {
                    //account = await this.get({ctx: ctx, key: name });
                    account = await this.getObject({ctx: ctx, objectName: name });
                } catch (err) {
                    this.logger.debug("Account not yet existing", { acount: name });
                }
                if (!account) account = {};
                
                let settings = await this.encrypt({ ctx: ctx, object: ctx.params.settings });
				
                this.logger.debug("Received settings", { settings: settings });
                _.set(account,"imap",_.get(settings,"imap",{}));
                _.set(account,"auth",_.get(settings,"auth",{}));
                
                this.logger.debug("Account data", { objectName: name, account: account });

                await this.putObject({ctx: ctx, objectName: name, value: account});
                return { account: name };
            }
        },
        
        /**
         * verify smtp settings
         * 
         * @actions
         * @param {String} account
         *  
         * @returns {Object} { test, err }
         */
        verify: {
            acl: "before",
            params: {
                account: [{ type: "string" },{ type: "object" }]
            },
            async handler(ctx) {
                let account;
                
                if (typeof ctx.params.account === "string") {
                    let name = ctx.params.account;
                    try {
                      //account = await this.get({ctx: ctx, key: name });
                        account = await this.getObject({ctx: ctx, objectName: name });
                        account = await this.decrypt({ ctx: ctx, object: account });
                    } catch (err) {
                        this.logger.debug("Account is not existing", { acount: name });
                        throw new Error(`Account ${name} is not existing`);
                    }
                } else {
                    account = ctx.params.account;
                    account = await this.decrypt({ ctx: ctx, object: account });
                }
                
                let result = {
                    test: false,
                    err: null 
                };
                if (account.imap ) {
                    try {
                        let self = this;
                        let imap = new Imap(this.createImapConfiguration(account));
                        let connect = () => { return new Promise((resolve, reject) => {
                            imap.once("ready", () => {
                                self.logger.debug("imap connection ready");
                                imap.destroy();
                                resolve(true);
                            }); 
                            
                            imap.once("error", function(err) {
                                self.logger.debug("Error imap connection", { err: err });
                                reject(err);
                            });

                            self.logger.debug("connect to i map");
                            imap.connect();
                        });};
                        result.test = await connect();
                    } catch (err) {
                        err.stack = "";
                        result.err = err;
                    }
                    this.logger.debug("Verify imap", { result });
                }
                return result;
            }
        },
        
        fetch: {
            acl: "before",
            params: {
                account: { type: "string" },
                seq: { type: "number", optional: true },
                uid: { type: "string", optional: true }
            },
            async handler(ctx) {
                let name = ctx.params.account;
                let account;
                
                try {
                    //account = await this.get({ctx: ctx, key: name });
                    account = await this.getObject({ctx: ctx, objectName: name });
                    account = await this.decrypt({ ctx: ctx, object: account });
                } catch (err) {
                    this.logger.debug("Account is not existing", { acount: name });
                    throw new Error(`Account ${name} is not existing`);
                }
                
                let imap = new Imap(this.createImapConfiguration(account));
                let messages = [];
                
                return new Promise((resolve, reject) => {

                    let fetch = (err, box) => {
                        if (err) reject(err);
                        this.logger.debug("Fetch mail via imap connection", { box: box });
                            
                        let f = imap.fetch([1], { bodies: ["HEADER"], size: true });
                        f.on("message", function(msg, seqno) {
                            let message = {
                                seq: seqno,
                                bodies: {}
                            };
                            
                            console.log("Message #%d", seqno);
                            let prefix = "(#" + seqno + ") ";
                            msg.on("body", function(stream, info) {
                                message.bodies[info.which] = {
                                  size: info.size
                                };
                                console.log(prefix + "Body");
                                console.log(info);
                                //stream.pipe(fs.createWriteStream("dev/msg-" + seqno + "-body.txt"));
                            });
                            msg.once("attributes", function(attrs) {
                                //console.log(prefix + "Attributes: %s", inspect(attrs, false, 8));
                                message.attrs = attrs;
                            });
                            msg.once("end", function() {
                                console.log(prefix + "Finished");
                                messages.push(message);
                            });
                        });
                        f.once("error", function(err) {
                            console.log("Fetch error: " + err);
                            reject(err);
                        });
                        f.once("end", function() {
                            console.log("Done fetching all messages!");
                            imap.end();
                            resolve(messages);
                        });
                    };
                    
                    imap.once("ready", () => {
                        this.logger.debug("imap connection ready - open inbox");
                        imap.openBox("INBOX", true, fetch); 
                    }); 
                    
                    imap.once("error", function(err) {
                        this.logger.debug("Error imap connection", { err: err });
                        reject(err);
                    });

                    imap.once("end", function() {
                        this.logger.debug("imap connection ended");
                        resolve(messages);
                    });                    
                    
                    this.logger.debug("connect to imap");
                    imap.connect();
                });
            }
        }

    },

    /**
     * Events
     */
    events: {},

    /**
     * Methods
     */
    methods: {
        
        createImapConfiguration(account) {
            return {
                host: account.imap.host,
                port: account.imap.port,
                tls: account.imap.tls,
                user: account.auth.user,
                password: account.auth.pass,
                authTimeout: account.imap.authTimeout
            };
        }
        
    },

    /**
     * Service created lifecycle event handler
     */
    created() {},

    /**
     * Service started lifecycle event handler
     */
    started() {},

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {}
    
};