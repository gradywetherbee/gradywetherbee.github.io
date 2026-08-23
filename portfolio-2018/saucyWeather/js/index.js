var celsius = true;

$(document).ready(function () {
  var unitElements = document.getElementsByClassName("changeUnitListener");
  for(var i =0; i < unitElements.length; i++){
    unitElements[i].addEventListener("click", switchUnits);
  }
  document.getElementById("sauce").addEventListener("click", slide);
    // Get Location
    navigator.geolocation.getCurrentPosition(success, error);
    $(".cover").fadeTo("slow", 0, function(){
      $(this).hide();
    });

    function success(pos) {
        var lat = pos.coords.latitude;
        var long = pos.coords.longitude;
        weather(lat, long);
    }

    function error() {
        console.log('There was an error');
    }

    // Call Weather
    function weather(lat, long) {
        var URL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${long}&APPID=a92c4a6040be8befd2f5a92eef5f2824`;
        var URL2 = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${long}&APPID=a92c4a6040be8befd2f5a92eef5f2824`;

        $.getJSON(URL, function(data) {
            updateDOM(data);
        });

        $.getJSON(URL2, function(data) {
            updateForecast(data);
        });
    }

    // Update Dom
    function updateDOM(data) {
        var city = data.name;
        var temp = 0;
        var unit ="";
        var tempInCelsius = Math.round(data.main.temp-273);
        if(celsius == true){
          unit = "C";
          temp = tempInCelsius;
        } else {
          unit = "F";
          temp = Math.round(1.8*tempInCelsius + 32);
        }
        //for testing background gradients - forces temp
        //tempInCelsius = temp = 33;
        var desc = "";
        var background = "";
        function saucify(tempInCelsius){
          if( tempInCelsius > 30) {
            desc = "Fucking sweltering."
            background = "linear-gradient(141deg, #FF2F00, #FFA600)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#FF2F00");
          }
          else if ( tempInCelsius > 19){
            desc = "Don't get used to this shit.";
            background = "linear-gradient(170deg, #FFEB00, #FF9100)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#FFEB00");
          }
          else if ( tempInCelsius > 15){
            desc = "Not quite what you wanted, is it?";
            background = "linear-gradient(159deg, #D9FF00 0%, #00FFAD 100%)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#D9FF00");
          }
          else if ( tempInCelsius > 13){
            desc = "You could wear a coat but fuck it.";
            background = "linear-gradient(141deg, #0fb8ad 0%, #1fc8db 51%, #2cb5e8 75%)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#0fb8ad");
          }
          else if ( tempInCelsius > 8){
            desc = "Suck it up, buttercup.";
            background = "linear-gradient(to right, #00D1CE 15%, #00F2FF)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#00D1Ce");
          }
          else if ( tempInCelsius > 0){
            desc = "Fucking cold.";
            $('html').css("color", "white");
            background = "linear-gradient(141deg, #3eb8ae 0%, #8fc8db 51%, #acb5e8 75%)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#3eb8ae");
          }
          else if ( tempInCelsius > -10){
            desc = "Really. Fucking. Cold.";
            $('html').css("color", "white");
            background = "linear-gradient(141deg, #3b49be 0%, #8b98bb 51%, #acb5e8 75%)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#3b49be");
          }
          else {
            desc = "Winter has motherfucking come.";
            $('html').css("color", "white");
            background = "linear-gradient(141deg, #123456 0%, #8ca5e8 75%)";
            document.querySelector('meta[name="theme-color"]').setAttribute("content", "#123456");
          }
        };
        saucify(tempInCelsius);
        $('#city').html(city);
        $('#currentTemp').html(temp);
        $('#sauce').html(desc);
        $('.unit').html("&#176;" + unit);
        $("#background").css("background-image", "none");
        console.log(background);
        $("#background").css("background", background);


    }

    // Update Forecast
    function updateForecast(data) {
        var temp1hrs = 0;
        var temp3hrs = 0;
        var temp24hrs = 0;
        var temp6hrs = 0;
        var unit ="";
        var dateUTC = new Date(data.list["8"].dt_txt);
        console.log(dateUTC);
        var date = dateUTC.toDateString();
        var temp1InCelsius = Math.round(data.list["0"].main.temp-273);
        var temp3InCelsius = Math.round(data.list["1"].main.temp-273);
        var temp6InCelsius = Math.round(data.list["2"].main.temp-273);
        var temp24InCelsius = Math.round(data.list["8"].main.temp-273);
        if(celsius == true){
          unit = "C";
          temp1hrs = temp1InCelsius;
          temp3hrs = temp3InCelsius;
          temp24hrs = temp24InCelsius;
          temp6hrs = temp6InCelsius;
        } else {
          unit = "F";
          temp1hrs = Math.round(1.8*temp1InCelsius + 32);
          temp3hrs = Math.round(1.8*temp3InCelsius + 32);
          temp6hrs = Math.round(1.8*temp6InCelsius + 32);
          temp24hrs = Math.round(1.8*temp24InCelsius + 32);
        }
        //temp = 20;
        var desc = "";
        var background = "";
        //$('#date').html(date);
        //$('#forecast').html("Forecast:");
        $('#1hrs').html("+1 hr");
        $('#3hrs').html("+3 hrs");
        $('#6hrs').html("+6 hrs");
        $('#24hrs').html("+1 day");
        $('#1hrsForecastTemp').html(temp1hrs);
        $('#3hrsForecastTemp').html(temp3hrs);
        $('#6hrsForecastTemp').html(temp6hrs);
        $('#24hrsForecastTemp').html(temp24hrs);
        $('.unit').html("&#176;" + unit);
        $(".degrees").fadeTo("slow", 1);
        $(".smallDegrees").fadeTo("slow", 1);
    }

    function slide(){
      var menu = document.querySelector('.degrees') // Using a class instead, see note below.
      menu.classList.toggle('slide-down');
      menu.classList.toggle('slide-up');
      var caption = document.getElementById('sauce');
      caption.classList.toggle('pad-more');
      caption.classList.toggle('pad-less');
    };

    function switchUnits(){
      $(".degrees").fadeTo(0.01, 0.01);
      $(".smallDegrees").fadeTo(0.01, 0.01);
      celsius = !celsius;
      navigator.geolocation.getCurrentPosition(success, error);
    };
});
