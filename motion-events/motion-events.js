

function handleMotion(event) {
    var acceleration                      = event.acceleration;
    var acceleration_including_gravity    = event.acceleration_including_gravity;
    var rotationRate                      = event.rotationRate;
    var interval                          = event.interval;
  
    window.alert(
        "acceleration: " + acceleration + 
        "\nacceleration_including_gravity: " + acceleration_including_gravity + 
        "\nrotationRate: " + rotationRate +
        "\ninterval: " + interval
    );

    console.log(
        "acceleration: " + acceleration + 
        "\nacceleration_including_gravity: " + acceleration_including_gravity + 
        "\nrotationRate: " + rotationRate +
        "\ninterval: " + interval);
  }

window.addEventListener("devicemotion", handleMotion, true);

window.alert("hello world");