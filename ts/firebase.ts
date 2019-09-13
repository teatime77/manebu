namespace manebu {
declare var firebase:any;
declare var navigator;

var textName  : HTMLInputElement;
var fileTreeView : HTMLUListElement;
var dlgFolder : HTMLDivElement;
var txtRaw : HTMLTextAreaElement;
export var dropZone : HTMLDivElement;

var db;

const default_uid = "Rb6xnDguG5Z9Jij6XLIPHV4oNge2";
var login_uid = null;
var guest_uid = default_uid;

class Doc {
    ctime  : number;
    mtime  : number;
    text   : string;
}

class FileInfo {
    name : string;
    id : number;
    children : FileInfo[] | undefined;

    constructor(name : string, is_file: boolean){
        this.name = name;
        this.id = getMaxFileId() + 1;

        if(! is_file){

            this.children = [];
        }
    }
}


var rootFile : FileInfo | null = null;
var selectedFile: FileInfo;

function getAllFileInfo() : FileInfo[] {
    function fnc(info: FileInfo, files: FileInfo[]){

        files.push(info);

        if(info.children != undefined){

            for(let x of info.children){
                fnc(x, files);
            }
        }
    }

    var files : FileInfo[] = [];
    fnc(rootFile, files);

    return files;
}

function getMaxFileId() : number {
    return Math.max(... getAllFileInfo().map(x => x.id));
}

function getFileById(id: number) : FileInfo | undefined{
    return getAllFileInfo().find(x => x.id == id);
}

function showFileTreeView(){
    function fnc(file:FileInfo, ul: HTMLUListElement){
        var li = document.createElement("li") as HTMLLIElement;
        ul.appendChild(li);

        var span = document.createElement("span");
        span.className = "span-file";
        span.innerHTML = file.name;
        span.addEventListener("click", function(ev:MouseEvent){
            ev.stopPropagation();

            var spans = fileTreeView.getElementsByClassName("span-file");
            for(let x of spans){

                (x as HTMLSpanElement).style.backgroundColor = "white";
            }

            var file_id = parseInt( this.dataset.file_id );
            selectedFile = getFileById(file_id);
            console.assert(selectedFile != undefined);

            this.style.backgroundColor = "lightgray";

            readFile(selectedFile, function(data:string){
                txtRaw.value = data;
            });
        });
        span.dataset.file_id = "" + file.id;

        li.appendChild(span);

        if(file.children != undefined){
            var ul2 = document.createElement("ul");
            li.appendChild(ul2);

            for(let x of file.children){
                fnc(x, ul2);
            }
        }
    }

    fileTreeView.innerHTML = "";
    fnc(rootFile, fileTreeView);
}

function readFile(file: FileInfo, fnc:(data:string)=>void){
    db.collection('users').doc(guest_uid).collection('docs').doc("" + file.id).get().then(function(doc) {
        if (doc.exists) {
            var doc_data = doc.data() as Doc;

            fnc(doc_data.text);
        } 
        else {
            // doc.data() will be undefined in this case

            msg(`[${file.id}]${file.name} はありません。`);
        }
    })
    .catch(function(error) {
        msg(`[${file.id}]${file.name} の読み込みエラーです。`);
    });
}

function showContents(){
    function fnc(file:FileInfo, ul: HTMLUListElement){
        var li = document.createElement("li") as HTMLLIElement;
        ul.appendChild(li);

        if(file.children == undefined){
            // ファイルの場合

            var link = document.createElement("button");
            link.innerHTML = file.name;
            link.dataset.file_id = "" + file.id;
            link.addEventListener("click", function(ev:MouseEvent){
                ev.stopPropagation();

                var file_id = parseInt( this.dataset.file_id );

                var file = getFileById(file_id);
                console.assert(file != undefined);

                readFile(file, openActionData);

                msg(`click:${file_id} ${this.textContent}`);
            });

            li.appendChild(link);
        }
        else{
            // フォルダーの場合

            var span = document.createElement("span");
            span.innerHTML = file.name;
            li.appendChild(span);

            var ul2 = document.createElement("ul");
            li.appendChild(ul2);

            for(let x of file.children){
                fnc(x, ul2);
            }
        }
    }

    var root_ul = document.getElementById("ulContents") as HTMLUListElement;
    root_ul.innerHTML = "";
    fnc(rootFile, root_ul);
}

function readFileTree(user_uid: string){
    db.collection('users').doc(user_uid).collection('docs').doc("root").get()
    .then(function(doc) {
        if (doc.exists) {
            var doc_data = doc.data() as Doc;

            if(doc_data.text != undefined){

                rootFile = JSON.parse(doc_data.text);

                if(inEditor){

                    (document.getElementById("btn-open-folder") as HTMLButtonElement).disabled = false;
                }
            }
            else{

                rootFile = new FileInfo("root", false);
            }
        } 
        else {
            // doc.data() will be undefined in this case
            msg("No such document!");

            rootFile = new FileInfo("root", false);
        }

        if(inEditor){

            showFileTreeView();
        }
        else{

            showContents();
        }
    })
    .catch(function(error) {
        msg(`Error getting document:${error}`);
        rootFile = new FileInfo("root", false);
    });
}

export function firebase_init(){
    firebase.auth().onAuthStateChanged(function(user: any) {
        login_uid = null;
        guest_uid = default_uid;
        
        if (user) {
            // User is signed in.
            msg(`login A ${user.uid} ${user.displayName} ${user.email}`);
    
            var user1 = firebase.auth().currentUser;
    
            if (user1) {
                // User is signed in.

                login_uid = user.uid;
                guest_uid = user.uid;

                msg(`login B ${user1.uid} ${user1.displayName} ${user1.email}`);
            } 
            else {
                // No user is signed in.

                msg("ログアウト");
            }    
        } 
        else {
            // User is signed out.
            // ...

            msg("ログアウト");
        }

        readFileTree(guest_uid);
    });

    db = firebase.firestore();

    if(! inEditor){
        return;
    }

    textName  = document.getElementById("text-name") as HTMLInputElement;
    fileTreeView = document.getElementById("file-tree-view") as HTMLUListElement;
    dlgFolder = document.getElementById("dlg-Folder") as HTMLDivElement;
    txtRaw = document.getElementById("txt-raw") as HTMLTextAreaElement;
    dropZone = document.getElementById('drop_zone') as HTMLDivElement;

    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);
}

function writeUserData(){
    var ctime = Math.round((new Date()).getTime());

    db.collection('users').doc(login_uid).collection('docs').doc("root").set({
        ctime  : ctime,
        mtime  : ctime,
        text   : JSON.stringify(rootFile)
    })
    .then(function() {
        msg("Document successfully written!");
    })
    .catch(function(error) {
        console.error("Error writing document: ", error);
    });
}

export function openFolder(){
    showFileTreeView();
    showPopup(dlgFolder);
}

export function closeFolder(){
    hidePopup(dlgFolder);
}

export function saveFolder(){
    writeUserData();

    hidePopup(dlgFolder);
}


export function make_folder(){
    var name = textName.value.trim();
    var new_folder = new FileInfo(name, false);

    selectedFile.children.push(new_folder);

    showFileTreeView();
}

function writeFile(file: FileInfo, text: string){
    var ctime = Math.round((new Date()).getTime());

    db.collection('users').doc(login_uid).collection('docs').doc("" + file.id).set({
        ctime  : ctime,
        mtime  : ctime,
        text   : text
    })
    .then(function() {
        msg(`[${file.id}]${file.name} に書き込みました。`);
    })
    .catch(function(error) {
        console.error("Error adding document: ", error);
    });
}

export function firebase_update(){
    var text = serializeActions();
    msg(`${text}`);

    writeFile(selectedFile, text);
}

function showPopup(div: HTMLDivElement){
    div.style.display = "grid"; // "inline-block";
    div.style.position = "fixed";
    div.style.left = "20px";
    div.style.top  = "20px";
    // div.style.width = `${window.innerWidth - 50}px`;
    // div.style.height = `${window.innerHeight - 50}px`;
    div.style.width = `${document.documentElement.clientWidth - 50}px`;
    div.style.height = `${document.documentElement.clientHeight - 50}px`;
}

function hidePopup(div: HTMLDivElement){
    div.style.display = "none";
}

export function openFile(){
    var file = selectedFile;

    db.collection('users').doc(guest_uid).collection('docs').doc("" + file.id).get().then(function(doc) {
        if (doc.exists) {
            var doc_data = doc.data() as Doc;

            openActionData(doc_data.text);       

            msg(`[${file.id}]${file.name} を読みこみました。`);

            hidePopup(dlgFolder);
        } 
        else {
            // doc.data() will be undefined in this case

            textMath.value = "";
            msg(`[${file.id}]${file.name} はありません。`);
        }
    })
    .catch(function(error) {
        msg(`[${file.id}]${file.name} の読み込みエラーです。`);
    });
}

export function make_file(){
    var name = textName.value.trim();
    var new_file = new FileInfo(name, true);

    writeFile(new_file, "");

    selectedFile.children.push(new_file);

    showFileTreeView();
}

function getImgRef(file_name: string, mode:string){
    // Create a root reference
    var storageRef = firebase.storage().ref();

    var uid: string;
    switch(mode){
    case "r": uid = guest_uid; break;
    case "w": uid = login_uid; break;
    default: console.assert(false); break;
    }

    return storageRef.child(`/users/${uid}/img/${file_name}`);
}

export function setSvgImg(img: SVGImageElement, file_name: string){
    var img_ref = getImgRef(file_name, "r");

    img_ref.getDownloadURL().then(function(downloadURL) {
        msg(`download URL: [${downloadURL}]`);
        
        img.setAttributeNS('http://www.w3.org/1999/xlink','href',downloadURL);
    });
}

export function setImgSrc(img: HTMLImageElement, file_name: string){
    var img_ref = getImgRef(file_name, "r");

    img_ref.getDownloadURL().then(function(downloadURL) {
        msg(`download URL: [${downloadURL}]`);

        img.src = downloadURL;
    });
}

function uploadFile(file: File){

    // Create a reference to 'mountains.jpg'
    var img_ref = getImgRef(file.name, "w");

    img_ref.put(file).then(function(snapshot) {
        snapshot.ref.getDownloadURL().then(function(downloadURL) {
            msg(`download URL: [${downloadURL}]`);

            dropZone.style.display = "none";            
        });

        var act = new ImgAction(file.name);
        actions.push(act);

        act.init();
    });    
}

export function writeRawText(){
    writeFile(selectedFile, txtRaw.value);
}

function handleFileSelect(ev: DragEvent) {
    ev.stopPropagation();
    ev.preventDefault();

    var files = ev.dataTransfer.files; // FileList object.

    for (let f of files) {
        msg(`drop name:${escape(f.name)} type:${f.type} size:${f.size} mtime:${f.lastModified.toLocaleString()} `);

        uploadFile(f);
    }
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

export function backup(){

    db.collection('users').doc(login_uid).collection('docs').get()
    .then((querySnapshot) => {
        var text: string = "";

        querySnapshot.forEach((dt) => {
            var doc = dt.data() as Doc;

            text += `id: ${dt.id}\n`;
            text += `ctime: ${doc.ctime}\n`;
            text += `mtime: ${doc.mtime}\n`;
            text += `${doc.text}<<EndOfDocument>>\n\n`;
        });

        navigator.clipboard.writeText(text).then(
        function() {
            msg("copy OK");
        }, 
        function() {
            msg("copy error");
        });
    });    
}

}