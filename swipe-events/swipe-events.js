window.alert("hello from swipe.js");

document.addEventListener('touchstart', handleTouchStart, false);        
document.addEventListener('touchend', handleTouchEnd, false);

var xDown = null;                                                        
var yDown = null;                                                        

function handleTouchStart(evt) {                                         
    xDown = evt.originalEvent.touches[0].clientX;                                      
    yDown = evt.originalEvent.touches[0].clientY;                                      
};                                                

function handleTouchEnd(evt) {  
    if ( ! xDown || ! yDown ) {
        return;
    }                      
                     
    var xUp = evt.originalEvent.touches[0].clientX;                                    
    var yUp = evt.originalEvent.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;   
                           
    window.alert(
        "xDiff: " + xDiff + 
        "\nyDiff: " + yDiff
    );
};     

function handleTouchMove(evt) {
    if ( ! xDown || ! yDown ) {
        return;
    }

    var xUp = evt.originalEvent.touches[0].clientX;                                    
    var yUp = evt.originalEvent.touches[0].clientY;

    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;
    var swipeDirection;

    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {/* most significant axis */
        if ( xDiff > 0 ) {
            swipeDirection = "left"
        } else {
            swipeDirection = "right"
        }                       
    } else {
        if ( yDiff > 0 ) {
            swipeDirection = "up" 
        } else { 
            swipeDirection = "down"
        }                                                                 
    }
    /* reset values */
    xDown = null;
    yDown = null;  
    
    window.alert(
        "xDiff: " + xDiff + 
        "\nyDiff: " + yDiff +
        "\nSwipe direction: " + swipeDirection
    );
};