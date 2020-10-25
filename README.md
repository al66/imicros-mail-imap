# imicros-mail-imap
[![Build Status](https://travis-ci.org/al66/imicros-mail-imap.svg?branch=master)](https://travis-ci.org/al66/imicros-mail-imap)
[![Coverage Status](https://coveralls.io/repos/github/al66/imicros-mail-imap/badge.svg?branch=master)](https://coveralls.io/github/al66/imicros-mail-imap?branch=master)
[![Development Status](https://img.shields.io/badge/status-experimental-orange)](https://img.shields.io/badge/status-experimental-orange)

[Moleculer](https://github.com/moleculerjs/moleculer)  service for handling mailboxes via imap

Requires additional running services: [imicros-minio](https://github.com/al66/imicros-minio) and [imicros-keys](https://github.com/al66/imicros-keys)

## Installation
```
$ npm install imicros-mail-imap --save
```

## ToDo's
Everything ... can currently only save and verify a connection
- getBoxes
- addBox
- delBox
- renameBox
- expunge
- append
- search
- fetch
- copy
- move
- addFlags
- deleteFlags
- setFlags
- addKeywords
- delKeywords
- setKeywords
