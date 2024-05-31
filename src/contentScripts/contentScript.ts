import Niconicomments, { V1Thread } from "@xpadev-net/niconicomments"
import { CommentThread } from "node_modules/youtubei.js/dist/src/parser/nodes";
import { Comments } from "node_modules/youtubei.js/dist/src/parser/youtube";
import { Innertube, ClientType } from 'youtubei.js';

interface CommentGetter {
    dispose: () => void,
    load: () => Promise<CommentThread[]>
}
function loadComments(youtube: Innertube, videoId: string, loadingMessage: {change:(message:string) => void}): CommentGetter {
    let commentThreads : CommentThread[] = [];
    let stop = false;

    return {
        dispose: () => {
            stop = true
            commentThreads = []
        },
        load: async () => {    
            const getNextContinuation = async (comments: Comments, total: number) => {
                const continuation = await comments.getContinuation();
                
                
                loadingMessage.change(`Loading comments... (${currently}/${total})`)
                
                commentThreads.push(...continuation.contents)

                currently = currently + commentThreads.length + 1;

                if(total > currently && !stop  && continuation.has_continuation) {
                    await getNextContinuation(continuation, total)
                }
            }
        
            const initialComments = await youtube.getComments(videoId, "TOP_COMMENTS");
            commentThreads.push(...initialComments.contents)

        
            if(initialComments.header === undefined && initialComments.header === undefined) {
                throw new Error("")
            }
        
        
            const total = Number(initialComments.header.count.runs![0].text.replaceAll(",", ""));
        
            let currently : number = commentThreads.length + 1;
            
            loadingMessage.change(`Loading comments... (${currently}/${total})`)
            
            if(total > currently && initialComments.has_continuation && !stop) {
                await getNextContinuation(initialComments, total)
            }

            return commentThreads
        }
    }
}

function appendCanvas(videoContainer: Element) {
    let returnCanvas: HTMLCanvasElement;

    const attachedCanvas = document.querySelector<HTMLCanvasElement>("#flow-comment-for-youtube-video-canvas")

    if(attachedCanvas === null) {
        const commentCanvas = document.createElement("canvas");
        
        commentCanvas.id = "flow-comment-for-youtube-video-canvas";
        commentCanvas.width = 1920;
        commentCanvas.height = 1080;
        commentCanvas.style.position = "absolute";
        commentCanvas.style.top = "0px"
        commentCanvas.style.left = "0px";
        commentCanvas.style.opacity = "80%"
        
        const videoResizeOb = new MutationObserver((r) => {
            const videoElem = r[0].target;
            if(isElem<HTMLVideoElement>(videoElem)) {
                commentCanvas.style.width = videoElem.style.width;
                commentCanvas.style.height = videoElem.style.height;
            }
        })

        videoContainer.appendChild(commentCanvas);

        const video = videoContainer.querySelector("video")!;
        commentCanvas.style.width = video.style.width;
        commentCanvas.style.height = video.style.height;
        videoResizeOb.observe(video, {attributes: true});            
        
        returnCanvas = commentCanvas;
    }
    else {
        returnCanvas = attachedCanvas;
    }

    return returnCanvas;

}

function formatToNicoComment(videoDuration: number, currentTime: number, comments: CommentThread[]): V1Thread {
    const v1threads: V1Thread = {
        id: undefined,
        fork: "",
        commentCount: comments.length,
        comments: []
    };

    let commentId = 0;

    comments.forEach(ytCommentThread => {
        const commentText = ytCommentThread.comment?.content?.text;

        if(commentText !== undefined) {
            let pos =  ((videoDuration * 1000 / comments.length) * commentId) + (currentTime * 1000);

            const timeMatch = commentText.match(/^([0-9]*:[0-9]*)\s.*$/);

            if(timeMatch !== null) {
                const time = timeMatch[1];

                const split = time.split(":");

                let hour = 0;
                let min = 0;
                let sec = 0;

                if(split.length === 2) {
                    min = Number(split[0])
                    sec = Number(split[1])
                }
                if(split.length === 3) {
                    hour = Number(split[0])
                    min = Number(split[1])
                    sec = Number(split[2])   
                }

                pos = (hour * 60 * 60 * 1000) + (min * 60 * 1000) + (sec * 1000);

            }

            v1threads.comments.push({
                id: String(commentId),
                no: commentId,
                vposMs: pos ,
                body: commentText,
                commands: [""],
                userId: "",
                isPremium: false,
                score: 0,
                postedAt: "",
                nicoruCount: 0,
                nicoruId: null,
                source: "",
                isMyPost: false
            })            
        }

        commentId++;
    })

    return v1threads;

}

interface LoadingMessage {
    remove: () => void,
    change:(msg: string) => void
}
function appendPopup(message: string) : LoadingMessage{
    const popupElem = document.createElement("div");
    popupElem.className = "flow-comment-for-youtube-video-message";

    popupElem.style.height = "50px"
    popupElem.style.borderRadius = "10px"
    popupElem.style.position = "fixed"
    popupElem.style.bottom = "40px"
    popupElem.style.right = "40px"
    popupElem.style.background = "#c25b8e"
    popupElem.style.color = "#141414"
    popupElem.style.fontSize = "18px"
    popupElem.style.display = "flex"
    popupElem.style.alignItems = "center"
    popupElem.style.padding = "5px 40px"
    popupElem.style.zIndex = "100"
    popupElem.textContent = "[Flow Comment for YouTube VIDEO] " +  message

    document.body.appendChild(popupElem)

    return {
        remove: () => {
            popupElem.remove();
        },
        change: (message: string) => {
            popupElem.textContent = "[Flow Comment for YouTube VIDEO] " +  message
        }
    }
}

let renderInterval: number | null = null;
let commentGetter: CommentGetter | null = null;
let loadingMessage : LoadingMessage | null = null;
let niconicomments : Niconicomments | null = null;

async function attachWatchPage() {
    if(commentGetter !== null) {
        commentGetter.dispose();
    }

    if(loadingMessage !== null) {
        loadingMessage.remove()
    }
    
    if(renderInterval !== null) {
        clearInterval(renderInterval);    
    }

    if(niconicomments !== null) {
        niconicomments.clear()
    }


    loadingMessage = appendPopup("Loading comments...")

    const videoContainer = await findElem(".html5-video-container");
    const video = videoContainer.querySelector("video")!
    const canvas = appendCanvas(videoContainer);

    canvas.style.display = "none";

    const videoId = window.location.search.split("?")[1].split("&").filter(search => {
        const [propertyName, value] = search.split("=");
        return propertyName === "v";
    })[0].split("=")[1]


    const youtube = await Innertube.create({
        fetch: (...args) => {
            return fetch(...args)
        },
        client_type: ClientType.WEB,
    });
    
    commentGetter = loadComments(youtube, videoId, loadingMessage)
    
    const allComments = await commentGetter.load();
    const commentData = formatToNicoComment(video.duration, video.currentTime, allComments);

    niconicomments = new Niconicomments(canvas, [commentData], {format: "v1"})

    loadingMessage.remove();
    canvas.style.display = "block";

    renderInterval = setInterval(() => {
        niconicomments?.drawCanvas(video.currentTime * 100)
    }, 10);
}

document.addEventListener("yt-navigate-finish", () => {
    const [_, pageName] = location.pathname.split("/");

    if(pageName === "watch") {
        attachWatchPage();
    }
});


function isElem<T extends Element>(node: Node): node is T {
    return node.nodeType === 1
}


function findElem<T extends Element>(selector:string): Promise<Element>{
    return new Promise((resolve) => {
        const i = setInterval(() => {
            const e = document.querySelector<T>(selector)
            if(e !== null) {
                clearInterval(i)
                resolve(e)
            }
        })
    })
}