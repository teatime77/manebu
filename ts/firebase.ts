namespace manebu {
declare var firebase:any;

var textName  : HTMLInputElement;
var textTitle : HTMLInputElement;
var fileTreeView : HTMLUListElement;
var db;
var uid = null;
var docs : Map<string, any>;

class Doc {
    ctime  : number;
    mtime  : number;
    path   : string;
    title  : string;
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

export function make_folder(){
    var name = textName.value.trim();
    var new_folder = new FileInfo(name, false);

    selectedFile.children.push(new_folder);

    showFileTreeView();
}

function showFileTreeView(){
    function fnc(file:FileInfo, ul: HTMLUListElement){
        var li = document.createElement("li") as HTMLLIElement;
        li.addEventListener("click", function(ev:MouseEvent){
            ev.stopPropagation();
            var file_id = parseInt( this.dataset.file_id );
            selectedFile = getFileById(file_id);
            console.assert(selectedFile != undefined);
            this.style.backgroundColor = "lightgray";
        });
        li.dataset.file_id = "" + file.id;
        ul.appendChild(li);

        var span = document.createElement("span");
        span.innerHTML = file.name;
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
    textTitle = document.getElementById("text-title") as HTMLInputElement;
    fileTreeView = document.getElementById("file-tree-view") as HTMLUListElement;

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

export function firebase_put(){
    if(uid == null){
        console.log("ログインしていません。");
        return;
    }

    writeUserData();

    var ctime = Math.round((new Date()).getTime());
    var path = textName.value.trim();
    var title = textTitle.value.trim();
    var text = textMath.value;

    db.collection('users').doc(uid).collection('docs').add({
        ctime  : ctime,
        mtime  : ctime,
        path   : path,
        title  : title,
        text   : text
    })
    .then(function(docRef) {
        console.log("Document written with ID: ", docRef.id);
    })
    .catch(function(error) {
        console.error("Error adding document: ", error);
    });
}

export function firebase_update(){

}

}