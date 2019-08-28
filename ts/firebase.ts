namespace manebu {
declare var firebase:any;

var textName  : HTMLInputElement;
var fileTreeView : HTMLUListElement;
var dlgFolder : HTMLDialogElement;

var db;
var uid = null;
var docs : Map<string, any>;

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

function readUserData(){
    var docRef = db.collection('users').doc(uid);

    docRef.get().then(function(doc) {
        if (doc.exists) {
            var user_data = doc.data();

            if(user_data.rootFile != undefined){

                rootFile = JSON.parse(user_data.rootFile);

                (document.getElementById("btn-open-folder") as HTMLButtonElement).disabled = false;
            }
            else{

                rootFile = new FileInfo("root", false);
            }
            console.log("Document data:", user_data);
        } 
        else {
            // doc.data() will be undefined in this case
            console.log("No such document!");

            rootFile = new FileInfo("root", false);
        }

        showFileTreeView();
    }).catch(function(error) {
        console.log("Error getting document:", error);
        rootFile = new FileInfo("root", false);

        showFileTreeView();
    });

}

function read_docs(){
    docs = new Map<string, any>();

    db.collection('users').doc(uid).collection('docs').get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            var data = doc.data();
            console.log(`${doc.id} => ${data}`);

            docs.set(doc.id, data);
        });
    });    
}

export function firebase_init(){
    firebase.auth().onAuthStateChanged(function(user: any) {
        if (user) {
            // User is signed in.
            console.log(`login A ${user.uid} ${user.displayName} ${user.email}`);
    
            var user1 = firebase.auth().currentUser;
    
            if (user1) {
                // User is signed in.

                uid = user.uid;
                console.log(`login B ${user1.uid} ${user1.displayName} ${user1.email}`);

                readUserData();
                read_docs();                
            } 
            else {
                // No user is signed in.

                uid = null;
                console.log("ログアウト");
            }    
        } 
        else {
            // User is signed out.
            // ...

            uid = null;
            console.log("ログアウト");
        }
    });

    textName  = document.getElementById("text-name") as HTMLInputElement;
    fileTreeView = document.getElementById("file-tree-view") as HTMLUListElement;
    dlgFolder = document.getElementById("dlg-Folder") as HTMLDialogElement;

    db = firebase.firestore();
}

function writeUserData(){
    db.collection('users').doc(uid).set({
        rootFile: JSON.stringify(rootFile)
    })
    .then(function() {
        console.log("Document successfully written!");
    })
    .catch(function(error) {
        console.error("Error writing document: ", error);
    });
}

export function openFolder(){
    showFileTreeView();
    dlgFolder.showModal();
}

export function closeFolder(){
    dlgFolder.close();
}

export function saveFolder(){
    writeUserData();

    dlgFolder.close();
}


export function make_folder(){
    var name = textName.value.trim();
    var new_folder = new FileInfo(name, false);

    selectedFile.children.push(new_folder);

    showFileTreeView();
}


function writeFile(file: FileInfo, text: string){
    var ctime = Math.round((new Date()).getTime());

    db.collection('users').doc(uid).collection('docs').doc("" + file.id).set({
        ctime  : ctime,
        mtime  : ctime,
        text   : text
    })
    .then(function() {
        console.log(`[${file.id}]${file.name} に書き込みました。`);
    })
    .catch(function(error) {
        console.error("Error adding document: ", error);
    });
}

export function firebase_update(){
    writeFile(selectedFile, textMath.value);
}

export function openFile(){
    var file = selectedFile;

    db.collection('users').doc(uid).collection('docs').doc("" + file.id).get().then(function(doc) {
        if (doc.exists) {
            var doc_data = doc.data() as Doc;

            textMath.value = doc_data.text;

            console.log(`[${file.id}]${file.name} を読みこみました。`);

            dlgFolder.close();
        } 
        else {
            // doc.data() will be undefined in this case

            textMath.value = "";
            console.log(`[${file.id}]${file.name} はありません。`);
        }
    })
    .catch(function(error) {
        console.log(`[${file.id}]${file.name} の読み込みエラーです。`);
    });
}

export function make_file(){
    var name = textName.value.trim();
    var new_file = new FileInfo(name, true);

    writeFile(new_file, "");

    selectedFile.children.push(new_file);

    showFileTreeView();
}


}