#SARAH-Plugin-Velo

Plugin vélo libre-service (Vélo'v, Vélib, ...etc.) pour S.A.R.A.H. (Self Actuated Residential Automated Habitat)  
[En savoir plus sur S.A.R.A.H.](http://blog.encausse.net/s-a-r-a-h/)

##Configuration

__Ce plugin a été testé avec le service de vélo libre-service Vélo'v (Lyon) mais vous pouvez très facilement changer de service.__  
Pour ce faire, il vous suffit de modifier le champs `city` dans le fichier `velo.prop` en renseignant un des noms de contrat disponible à cette URL : [https://developer.jcdecaux.com/#/opendata/vls?page=static](https://developer.jcdecaux.com/#/opendata/vls?page=static)  
```javascript
        "city": "[Contract name]",
```
(Pour une question de logique, il faudrait aussi modifier la grammaire xml ainsi que la constante `DICTATION_REGEX` du fichier `velo.js`).      

Ce plugin utilise deux APIs:

* Google Gecoding API ([https://developers.google.com/maps/documentation/geocoding/intro](https://developers.google.com/maps/documentation/geocoding/intro))
* JCDecaux API ([https://developer.jcdecaux.com/#/opendata/vls?page=getstarted](https://developer.jcdecaux.com/#/opendata/vls?page=getstarted))

L'API Google permet de retrouver la longitude et la latitude d'un adresse donnée.  
L'API JCDecaux permet de récuperer les informations sur les stations de vélo en libre-service.  

Pour utiliser ce plugin il vous faudra donc récupérer deux API keys à renseigner dans le fichier `velo.prop` :  
```javascript
        "jcDecauxApiKey": "[Your JCDecaux API key]",
        "geocodingApiKey": "[Your Google Geocoding API key]"
```      

Vous pouvez ajouter dans le fichier de configuration `velo.prop` une adresse favorite ou un numéro de station favoris.
```javascript
        "address": "3 rue des Près, 69909 LYON",
        "stationNumber": "9002"
```
La recherche par numéro de station est plus performante que par adresse (un appel API en moins).      

Pour des questions de performance, la liste des stations est lu à partir d'un fichier json (pour ne pas faire trop d'appel API).  
Afin de mettre à jour ce fichier avec les données retournées par la JCDecaux API, il faut utiliser la commande vocale S.A.R.A.H. `"met à jour la liste des stations vélov"`.

##Utilisation

###1 - Par adresse
Commande vocale  
`Sarah donne moi la station vélov la plus proche de l'adresse 3 rue des Près, 69009 LYON`  
Retour  
`La station 9002 - MAIRIE du 9ème, situé Prox. métro Valmy est ouverte. 5 vélos sont disponibles et 17 places sont libres.`

###2 - Par station/adresse favorite
Commande vocale  
`Sarah donne moi les informations vélov`  
Retour  
`La station 9002 - MAIRIE du 9ème, situé Prox. métro Valmy est ouverte. 5 vélos sont disponibles et 17 places sont libres.`

###3 - Mise à jour de la liste des stations
Commande vocale  
`Sarah met à jour la liste des stations vélov`  
Retour  
`La liste des stations à bien été mise à jour`

##Compatibilité

Ce plugin a été testé avec NodeJS en version v0.12.6 et S.A.R.A.H en version v3.

##License

The MIT License (MIT)

Copyright (c) 2015, Thomas Lelievre

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
