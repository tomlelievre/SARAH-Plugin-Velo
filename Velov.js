const VELOV_URL = "https://api.jcdecaux.com/vls/v1/stations/";
const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const VELOV_LIST_FILENAME = 'velov-stations-list.json';

var request = require('request'),
    jsonfile = require('jsonfile'),
    address = '145+avenue+Lacassagne,+69903+LYON';

exports.action = function (data, callback, config, SARAH) {

    var properties = config.modules.Velov;

    if (!properties.city || !properties.jcDecauxApiKey || !properties.googleApikey) {
        callback({'tts': "Désolé, ma configuration ne me permet pas de trouver l'adresse demandée."});
        return;
    }

    // TODO: retrieve address from SARAH dictation
    /*
     // Retrieves and formats the address in command line arguments
     if (2 in process.argv)
     address = formatAddress(process.argv[2]);
     */

    var geocodingUrl = GEOCODING_URL + '?address=' + address + ',+FR&key=' + config.googleApiKey;

    // Calls the Google Geocoding API to retrieve the geocoded latitude/longitude value of the address
    callAPI(geocodingUrl, function (geocodingApiResult) {

        // Gets the geocoded latitude/longitude value of the address
        var geocodingPosition = geocodingApiResult.results[0].geometry.location;

        // Retrieves the Velov stations list from JSON file
        jsonfile.readFile(VELOV_LIST_FILENAME, function (error, velovApiResult) {

            if (error) {
                callback({'tts': "Impossible de lire la liste des stations Velov."});
                return;
            }

            // Calculation of the distance between Velov station and address geocoded latitude/longitude values
            var stationDistances = computeGeopositionDistances(velovApiResult, geocodingPosition);

            // Searching of nearest Velov stations compared to the address (min distance)
            aggregateVelovApiData(findNearestVelovStations(stationDistances, 3), 0, [], function (velovApiData) {
                console.log(velovApiData);
                return velovApiData;
            });
        });
    });
};

function convertVelovApiDataInSARAHSpeech(velovApiData) {
    /*
     { number: 3051,
     name: '3051 - PLACE HENRI',
     address: 'Angle rue Docteur Long/av. Lacassagne',
     position: { lat: 45.748193, lng: 4.880641 },
     banking: true,
     bonus: false,
     status: 'OPEN',
     contract_name: 'Lyon',
     bike_stands: 13,
     available_bike_stands: 12,
     available_bikes: 0,
     last_update: 1436196004000 }
     */

    var speech = '';

    for (var i in velovApiData) {
        var velovData = velovApiData[i];

        speech += 'La station ' + velovData.name;

        if (velovData.address != '')
            speech += ' situé ' + velovData.address;

        if (velovData.status === 'OPEN') {
            speech += ' est ouverte.';
        } else {
            speech += ' est fermée.';
            continue;
        }

        speech += velovData.available_bikes + ' vélos sont disponibles et ' + velovData.available_bike_stands + ' places sont libres.';
    }
}

/**
 * Aggregates the several Velov API returned data
 * @param nearestStationNumbers
 * @param index
 * @param velovApiData
 * @param callback
 */
function aggregateVelovApiData(nearestStationNumbers, index, velovApiData, callback) {
    callAPI(VELOV_URL + nearestStationNumbers[index].stationNumber + '?contract=' + config.city + '&apiKey=' + config.jcDecauxApiKey, function (nearestStation) {
        velovApiData.push(nearestStation);
        index++;

        if (index < nearestStationNumbers.length) {
            aggregateVelovApiData(nearestStationNumbers, index, velovApiData, callback)
        } else {
            callback(velovApiData);
        }
    });
}

/**
 * Calls API and returns the response in JSON format
 * @param url
 * @param callback
 */
function callAPI(url, callback) {
    request({'uri': url}, function (error, response, body) {

        if (error || response.statusCode != 200) {
            callback({'tts': "Impossible d'accéder à l'API."});
            return;
        }

        var apiResult = JSON.parse(body);
        callback(apiResult);
    });
}

/**
 * Computes distances between the Velov station and address geocoded latitude/longitude values
 * @param velovApiResult
 * @param geocodingPosition
 */
function computeGeopositionDistances(velovApiResult, geocodingPosition) {
    var stationDistances = [];
    for (var i in velovApiResult) {
        var stationVelov = velovApiResult[i];
        stationDistances.push({
            stationNumber: stationVelov.number,
            distance: 6371 * Math.acos(Math.cos(Math.radians(geocodingPosition.lat)) * Math.cos(Math.radians(stationVelov.position.lat)) * Math.cos(Math.radians(stationVelov.position.lng) - Math.radians(geocodingPosition.lng)) + Math.sin(Math.radians(geocodingPosition.lat)) * Math.sin(Math.radians(stationVelov.position.lat)))
        });
    }

    return stationDistances;
}

/**
 * Searching of the nearest Velov station compared to the address (min distance)
 * @param stationDistances
 * @param nbStation
 */
function findNearestVelovStations(stationDistances, nbStation) {
    stationDistances.sort(function (a, b) {
        return parseFloat(a.distance) - parseFloat(b.distance);
    });

    return stationDistances.slice(0, nbStation);
}

/**
 * Writes a json file with all Velov station informations
 */
function updateVelovStationList() {
    // Call the JCDecaux Velov API to retrieve stations list
    callAPI(VELOV_URL + stationNumberArg + '?contract=' + config.city + '&apiKey=' + config.jcDecauxApiKey, function (velovApiResult) {
        jsonfile.writeFile(VELOV_LIST_FILENAME, velovApiResult);
        console.log('Velov stations list file updated');
    });
}

/**
 * Formats the address to pass it in url
 * @param address
 * @returns {string}
 */
function formatAddress(address) {
    return address.replace(/\ /g, '+')
        .replace(/[èéêë]/gi, 'e')
        .replace(/[àâä]/gi, 'a')
        .replace(/[oôö]/gi, 'o')
        .replace(/[ùûü]/gi, 'u')
        .replace(/[iîï]/gi, 'i');
}

Math.radians = function (degrees) {
    return degrees * Math.PI / 180;
};
