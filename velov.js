/*************************************************************************
 *  SARAH-Plugin-Velov - velov.js
 *************************************************************************
 *  @author
 *      Thomas Lelievre <toma.jackrabbit@gmail.com>
 *  @date
 *      July 2015
 *************************************************************************/

var request = require('request'),
    jsonfile = require('jsonfile'),
    properties;

const VELOV_URL = "https://api.jcdecaux.com/vls/v1/stations/";
const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const VELOV_LIST_FILENAME = 'velov-stations-list.json';

exports.action = function (data, callback, config, SARAH) {

    properties = config.modules.velov;

    if (!properties.city || !properties.jcDecauxApiKey || !properties.googleApiKey)
        return callback({'tts': "Désolé, ma configuration ne me permet pas d'utiliser convenablement ce pleuguine."});

    var address = '';

    switch (data.action) {
        case 'address':
            var search = data.dictation,
                rgxp = /Sarah donne-moi la station Velo'v la plus proche de l'adresse (.+)/i,
                match;

            // Checks Google understanding with the regexs
            if (match = checkGoogleUnderstanding(search, rgxp))
                address = formatAddress(match[1]);
            else
                return callback({'tts': "Je ne comprends pas."});

            getVelovStationDataByAddress(address, callback);
            break;
        case 'update_velov_file':
            updateVelovStationList(callback);
            break;
        default:
        case 'common':
            if (!properties.address)
                return callback({'tts': "Veuillez renseigner une adresse dans la configuration du plugin vélove."});

            address = formatAddress(properties.address)
            getVelovStationDataByAddress(address, callback);
            break;
    }
};

var getVelovStationDataByAddress = function (address, callback) {
        var geocodingUrl = GEOCODING_URL + '?address=' + address + ',+FR&key=' + properties.googleApiKey;

        // Calls the Google Geocoding API to retrieve the geocoded latitude/longitude value of the address
        callAPI(geocodingUrl, function (geocodingApiResult) {

            // Gets the geocoded latitude/longitude value of the address
            if (typeof geocodingApiResult.results[0] === 'undefined')
                return callback({'tts': "Je n'arrive pas à trouver l'adresse."});

            var geocodingPosition = geocodingApiResult.results[0].geometry.location;

            // Retrieves the Velov stations list from JSON file
            jsonfile.readFile(__dirname + '\\' + VELOV_LIST_FILENAME, function (error, velovApiResult) {

                if (error)
                    return callback({'tts': "Impossible de lire la liste des stations Vélove."});

                // Calculation of the distance between Velov station and address geocoded latitude/longitude values
                var stationDistances = computeGeopositionDistances(velovApiResult, geocodingPosition);

                // Searching of nearest Velov stations compared to the address (min distance)
                aggregateVelovApiData(findNearestVelovStations(stationDistances, 1), 0, [], function (velovApiData) {
                    var velovDataSpeech = convertVelovApiDataInSARAHSpeech(velovApiData);
                    callback({'tts': velovDataSpeech});
                });
            });
        });
    },

    /**
     * @param velovApiData
     * @returns {string}
     */
    convertVelovApiDataInSARAHSpeech = function (velovApiData) {
        var speech = '';

        for (var i in velovApiData) {
            var velovData = velovApiData[i];

            speech += 'La station ' + velovData.name;

            if (velovData.address != '')
                speech += '... situé ' + velovData.address;

            if (velovData.status === 'OPEN') {
                speech += '... est ouverte. ...';
            } else {
                speech += '... est fermée. ...';
                continue;
            }

            speech += conjugate(velovData.available_bikes,
                ' {nb} vélos sont disponibles et ',
                ' un vélo est disponible et ',
                ' aucun vélo n\'est disponible et ');

            speech += conjugate(velovData.available_bike_stands,
                ' {nb} places sont libres.     ',
                ' une place est libre.     ',
                ' aucune place n\'est libre.     ');
        }

        return speech;
    },

    /**
     * Checks if Google correctly understanding the dictation
     * @param search
     * @param regex
     */
    checkGoogleUnderstanding = function (search, regex) {
        var match = search.match(regex);

        if (!match || match.length <= 1)
            return false;

        return match;
    },

    /**
     * Aggregates the several Velov API returned data
     * @param nearestStationNumbers
     * @param index
     * @param velovApiData
     * @param callback
     */
    aggregateVelovApiData = function (nearestStationNumbers, index, velovApiData, callback) {
        callAPI(VELOV_URL + nearestStationNumbers[index].stationNumber
        + '?contract=' + properties.city
        + '&apiKey=' + properties.jcDecauxApiKey, function (nearestStation) {
            velovApiData.push(nearestStation);
            index++;

            if (index < nearestStationNumbers.length)
                aggregateVelovApiData(nearestStationNumbers, index, velovApiData, callback)
            else
                callback(velovApiData);
        });
    },

    /**
     * Calls API and returns the response in JSON format
     * @param url
     * @param callback
     */
    callAPI = function (url, callback) {
        request({'uri': url}, function (error, response, body) {

            if (error || response.statusCode != 200)
                return callback({'tts': "Impossible d'accéder à l'API."});

            var apiResult = JSON.parse(body);
            callback(apiResult);
        });
    },

    /**
     * Computes distances between the Velov station and address geocoded latitude/longitude values
     * @param velovApiResult
     * @param geocodingPosition
     */
    computeGeopositionDistances = function (velovApiResult, geocodingPosition) {
        var stationDistances = [];
        for (var i in velovApiResult) {
            var stationVelov = velovApiResult[i];
            stationDistances.push({
                stationNumber: stationVelov.number,
                distance: 6371 * Math.acos(Math.cos(radians(geocodingPosition.lat))
                * Math.cos(radians(stationVelov.position.lat))
                * Math.cos(radians(stationVelov.position.lng) - radians(geocodingPosition.lng))
                + Math.sin(radians(geocodingPosition.lat))
                * Math.sin(radians(stationVelov.position.lat)))
            });
        }

        return stationDistances;
    },

    /**
     * Searching of the nearest Velov station compared to the address (min distance)
     * @param stationDistances
     * @param nbStation
     */
    findNearestVelovStations = function (stationDistances, nbStation) {
        stationDistances.sort(function (a, b) {
            return parseFloat(a.distance) - parseFloat(b.distance);
        });

        return stationDistances.slice(0, nbStation);
    },

    /**
     * Writes a json file with all Velov station informations
     * @param callback
     */
    updateVelovStationList = function (callback) {
        // Call the JCDecaux Velov API to retrieve stations list
        callAPI(VELOV_URL
        + '?contract=' + properties.city
        + '&apiKey=' + properties.jcDecauxApiKey, function (velovApiResult) {
            jsonfile.writeFile(__dirname + '\\' + VELOV_LIST_FILENAME, velovApiResult);

            console.log('Velov stations list file updated');
            return callback({'tts': 'La liste des stations Vélove à bien été mise à jour'});
        });
    },

    /**
     * Formats the address to pass it in url
     * @param address
     * @returns {string}
     */
    formatAddress = function (address) {
        return address.replace(/\ /g, '+')
            .replace(/[èéêë]/gi, 'e')
            .replace(/[àâä]/gi, 'a')
            .replace(/[oôö]/gi, 'o')
            .replace(/[ùûü]/gi, 'u')
            .replace(/[iîï]/gi, 'i');
    },

    /**
     * Converts degrees to radians
     * @param degrees
     * @returns {number}
     */
    radians = function (degrees) {
        return degrees * Math.PI / 180;
    },

    /**
     * Change sentence according to the "nb" parameter
     * @param nb
     * @param several
     * @param one
     * @param none
     * @returns {string}
     */
    conjugate = function (nb, several, one, none) {
        var sentence = '';

        if (nb > 1)
            sentence += several;
        else if (nb = 1)
            sentence += one;
        else
            sentence += none;

        return sentence.replace('{nb}', nb);
    };
