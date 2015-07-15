/*************************************************************************
 *  SARAH-Plugin-Velo - velo.js
 *************************************************************************
 *  @author
 *      Thomas Lelievre <toma.jackrabbit@gmail.com>
 *  @date
 *      July 2015
 *************************************************************************/

var request = require('request'),
    jsonfile = require('jsonfile'),
    properties;

const JCDECAUX_API_URL = "https://api.jcdecaux.com/vls/v1/stations/";
const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const STATIONS_LIST_FILENAME = 'stations-list.json';
const DICTATION_REGEX = /Sarah donne-moi la station Velo'v la plus proche de l'adresse (.+)/i;

exports.action = function (data, callback, config, SARAH) {

    properties = config.modules.velo;

    if (!properties.city || !properties.jcDecauxApiKey || !properties.geocodingApiKey)
        return callback({'tts': "Désolé, ma configuration ne me permet pas d'utiliser convenablement ce pleuguine."});

    var address = '';

    switch (data.action) {
        case 'address':
            var search = data.dictation,
                rgxp = DICTATION_REGEX,
                match;

            // Checks Google understanding with the regexs
            if (match = checkGoogleUnderstanding(search, rgxp))
                address = formatAddress(match[1]);
            else
                return callback({'tts': "Je ne comprends pas."});

            getStationDataByAddress(address, callback);
            break;
        case 'update_stations_list':
            updateStationsList(callback);
            break;
        default:
        case 'common':
            if (!properties.address || !properties.stationNumber)
                return callback({'tts': "Veuillez renseigner une adresse ou un numéro de station dans la configuration du pleuguine vélo."});

            address = formatAddress(properties.address)
            getStationDataByAddress(address, callback);
            break;
    }
};

var getStationDataByAddress = function (address, callback) {
        var geocodingUrl = GEOCODING_API_URL + '?address=' + address + ',+FR&key=' + properties.geocodingApiKey;

        // Calls the Google Geocoding API to retrieve the geocoded latitude/longitude value of the address
        callAPI(geocodingUrl, function (geocodingApiResult) {

            // Gets the geocoded latitude/longitude value of the address
            if (typeof geocodingApiResult.results[0] === 'undefined')
                return callback({'tts': "Je n'arrive pas à trouver l'adresse."});

            var geocodingPosition = geocodingApiResult.results[0].geometry.location;

            // Retrieves the stations list from JSON file
            jsonfile.readFile(__dirname + '\\' + STATIONS_LIST_FILENAME, function (error, jcdecauxApiResult) {

                if (error)
                    return callback({'tts': "Impossible de lire la liste des stations."});

                // Calculation of the distance between station and address geocoded latitude/longitude values
                var stationDistances = computeGeopositionDistances(jcdecauxApiResult, geocodingPosition);

                // Searching of nearest stations compared to the address (min distance)
                aggregateJCDecauxApiData(findNearestStations(stationDistances, 1), 0, [], function (jcdecauxApiData) {
                    var veloDataSpeech = convertJCDecauxApiDataInSARAHSpeech(jcdecauxApiData);
                    callback({'tts': veloDataSpeech});
                });
            });
        });
    },

    /**
     * @param jcdecauxApiData
     * @returns {string}
     */
    convertJCDecauxApiDataInSARAHSpeech = function (jcdecauxApiData) {
        var speech = '';

        for (var i in jcdecauxApiData) {
            var veloData = jcdecauxApiData[i];

            speech += 'La station ' + veloData.name;

            if (veloData.address != '')
                speech += '... situé ' + veloData.address;

            if (veloData.status === 'OPEN') {
                speech += '... est ouverte. ...';
            } else {
                speech += '... est fermée. ...';
                continue;
            }

            speech += conjugate(veloData.available_bikes,
                ' {nb} vélos sont disponibles et ',
                ' un vélo est disponible et ',
                ' aucun vélo n\'est disponible et ');

            speech += conjugate(veloData.available_bike_stands,
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
     * Aggregates the several JCDecaux API returned data
     * @param nearestStationNumbers
     * @param index
     * @param jcdecauxApiData
     * @param callback
     */
    aggregateJCDecauxApiData = function (nearestStationNumbers, index, jcdecauxApiData, callback) {
        callAPI(JCDECAUX_API_URL + nearestStationNumbers[index].stationNumber
        + '?contract=' + properties.city
        + '&apiKey=' + properties.jcDecauxApiKey, function (nearestStation) {
            jcdecauxApiData.push(nearestStation);
            index++;

            if (index < nearestStationNumbers.length)
                aggregateJCDecauxApiData(nearestStationNumbers, index, jcdecauxApiData, callback)
            else
                callback(jcdecauxApiData);
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
     * Computes distances between the station and address geocoded latitude/longitude values
     * @param jcdecauxApiResult
     * @param geocodingPosition
     */
    computeGeopositionDistances = function (jcdecauxApiResult, geocodingPosition) {
        var stationDistances = [];
        for (var i in jcdecauxApiResult) {
            var station = jcdecauxApiResult[i];
            stationDistances.push({
                stationNumber: station.number,
                distance: 6371 * Math.acos(Math.cos(radians(geocodingPosition.lat))
                * Math.cos(radians(station.position.lat))
                * Math.cos(radians(station.position.lng) - radians(geocodingPosition.lng))
                + Math.sin(radians(geocodingPosition.lat))
                * Math.sin(radians(station.position.lat)))
            });
        }

        return stationDistances;
    },

    /**
     * Searching of the nearest station compared to the address (min distance)
     * @param stationDistances
     * @param nbStation
     */
    findNearestStations = function (stationDistances, nbStation) {
        stationDistances.sort(function (a, b) {
            return parseFloat(a.distance) - parseFloat(b.distance);
        });

        return stationDistances.slice(0, nbStation);
    },

    /**
     * Writes a json file with all station informations
     * @param callback
     */
    updateStationsList = function (callback) {
        // Call the JCDecaux API to retrieve stations list
        callAPI(JCDECAUX_API_URL
        + '?contract=' + properties.city
        + '&apiKey=' + properties.jcDecauxApiKey, function (jcdecauxApiResult) {
            jsonfile.writeFile(__dirname + '\\' + STATIONS_LIST_FILENAME, jcdecauxApiResult);

            console.log('Stations list file updated');
            return callback({'tts': 'La liste des stations à bien été mise à jour'});
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
