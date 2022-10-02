"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveChat = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const axios_1 = tslib_1.__importDefault(require("axios"));
const parser_1 = require("./parser");
/**
 * YouTubeライブチャット取得イベント
 */
class LiveChat extends events_1.EventEmitter {
    constructor(options, interval = 1000) {
        super();
        this.interval = interval;
        this.prevTime = Date.now();
        if ('channelId' in options) {
            this.channelId = options.channelId;
        }
        else if ('liveId' in options) {
            this.liveId = options.liveId;
        }
        else {
            throw TypeError("Required channelId or liveId.");
        }
    }
    async start() {
        var liveRes = null;
        if (this.liveId) {
            liveRes = await axios_1.default.get(`https://www.youtube.com/watch?v=${this.liveId}`, { headers: LiveChat.headers });
            if (liveRes.data.match(/LIVE_STREAM_OFFLINE/)) {
                this.emit('error', new Error("Live stream offline"));
                return false;
            }
        }
        if (this.channelId) {
            liveRes = await axios_1.default.get(`https://www.youtube.com/channel/${this.channelId}/live`, { headers: LiveChat.headers });
            if (liveRes.data.match(/LIVE_STREAM_OFFLINE/)) {
                this.emit('error', new Error("Live stream offline"));
                return false;
            }
            this.liveId = liveRes.data.match(/"liveStreamabilityRenderer":{"videoId":"(\S*?)",/)[1];
        }
        if (!this.liveId || liveRes === null) {
            this.emit('error', new Error('Live stream not found'));
            return false;
        }
        this.key = liveRes.data.match(/"INNERTUBE_API_KEY":"(\S*?)"/)[1];
        this.continuation = liveRes.data.match(/"continuation":"(\S*?)"/)[1];
        this.clientName = liveRes.data.match(/"clientName":"(\S*?)"/)[1];
        this.clientVersion = liveRes.data.match(/"clientVersion":"(\S*?)"/)[1];
        this.observer = setInterval(() => this.fetchChat(), this.interval);
        this.emit('start', this.liveId);
        return true;
    }
    stop(reason) {
        if (this.observer) {
            clearInterval(this.observer);
            this.emit('end', reason);
        }
    }
    async fetchChat() {
        const res = await axios_1.default.post(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.key}`, {
            context: {
                client: {
                    clientName: this.clientName,
                    clientVersion: this.clientVersion,
                }
            },
            continuation: this.continuation
        }, { headers: LiveChat.headers });
        if (res.data.continuationContents.messageRenderer) {
            this.stop("Live stream is finished");
            return;
        }
        const items = res.data.continuationContents.liveChatContinuation.actions.slice(0, -1)
            .filter((v) => {
            const messageRenderer = (0, parser_1.actionToRenderer)(v);
            if (messageRenderer !== null) {
                if (messageRenderer) {
                    return (0, parser_1.usecToTime)(messageRenderer.timestampUsec) > this.prevTime;
                }
            }
            return false;
        })
            .map((v) => (0, parser_1.parseData)(v));
        items.forEach((v) => {
            this.emit('comment', v);
        });
        if (items.length > 0) {
            this.prevTime = items[items.length - 1].timestamp;
        }
    }
    on(event, listener) {
        return super.on(event, listener);
    }
}
exports.LiveChat = LiveChat;
LiveChat.headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36' };
//# sourceMappingURL=live-chat.js.map