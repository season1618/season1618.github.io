function root(id) {
    if(id == -1){
        for(let i = 0; i < 5; i++){
            document.getElementById(i).className = 'block';
        }
        return;
    }
    for(let i = 0; i < 5; i++){
        document.getElementById(i).className = (i == id ? 'block' : 'none');
    }console.log('hello')
}