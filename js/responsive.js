window.onload = layoutcss();

function layoutcss(){
    //mobile device?
    var mobileNavButton = document.getElementsByClassName("mobile-nav-button")[0];
    var navList = document.getElementsByClassName("nav-list")[0];
    var navLinks = document.getElementsByClassName("nav-link");
    if(/iPhone|iphone|blackberry|webos|windows phone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 600){
        try{
            mobileNavButton.style.display = "inherit";
            mobileNavButton.addEventListener("click", showHideMobileNavList);
            navList.classList.add('mobile-nav');
            navList.classList.add('hide');
            for (var i = 0; i < navLinks.length; i++) {
              navLinks[i].classList.add('mobile-nav-link');
            }
            //navList.innerHTML += ".mobile-nav";
        }
        catch(e){
            console.log(mobileNavButton);
            console.log(navLinks);
            alert(e);
        }
    }
    else{
        try{
            mobileNavButton.style.display = "none";
            navList.classList.remove('mobile-nav');
            navList.classList.remove("hide");
            for (var i = 0; i < navLinks.length; i++) {
              navLinks[i].classList.remove('mobile-nav-link');
            }
        }
        catch(e){
            alert(e + " 2");
        }
    }
}

function showHideMobileNavList(){
    var mobileNavList = document.getElementsByClassName('nav-list')[0];
    mobileNavList.classList.toggle("hide");
    document.getElementById("a3-line1").classList.toggle("a3-line1-close");
    document.getElementById("a3-line2").classList.toggle("a3-line2-close");
    document.getElementById("a3-line3").classList.toggle("a3-line3-close");
};
