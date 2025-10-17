/*
Define here the views and scope of data available to the
  - GBIF data explorer (gbif_data_widget.js)
  - GBIF literature explorer (gbif_lit_widget.js)
  - VAL GBIF species explorer (gbif_species_search.js, gbif_species_results.js)
  - VAL GBIF species search/autocomplete (gbif_species_search.js, gbif_auto_complete.js)
  - VAL GBIF dashboard stats (gbif_data_stats.js)

  The Atlas siteName is passed to this file one of two ways:
  - as an http query parameter: siteName=val
  - as a meta query parameter: import { dataConfig } from '../VAL_Web_Utilities/js/gbifDataConfig.js?siteName=val'
*/
import { getStoredData } from './storedData.js';

//get URL search params from calling http route address
const thisUrl = new URL(document.URL);

// Get the URL that loaded us, if we're in an iframe
var parentUrl = document.referrer;
console.log('Parent URL:', parentUrl);

// Extract domain from referrer
if (parentUrl) {
    parentUrl = new URL(parentUrl);
    console.log('Parent hostname:', parentUrl.hostname);
    console.log('Parent pathname:', parentUrl.pathname);
}

/*
  Deal with setting siteName in one place. The order of precedence:
    siteConfig.js=>siteConfig.siteName (file stored at project level)
    localStorage value 'siteName' (passed here as 'storSite')
    meta URL param ('siteName' passed file->file using file query param)
    http URL param ('siteName' passed document's http URL query param)

    Note that for VAL_Remote_Explorers, localStorage is set in localSiteConfig.js from its own siteConfig.siteName or metaSite siteName.
    js/localSiteConfig.js is an optional include file, used to override others to force a siteName for a deployment.
*/
export async function getSite(httpUrl=thisUrl) {
  //get URL search params from calling module file - a cool feature called a metaURL
  const metaUrl = new URL(import.meta.url); //lower case '.url' is a property
  const metaSite = metaUrl.searchParams.get('siteName'); //calling modules do this: import { dataConfig } from '../VAL_Web_Utilities/js/gbifDataConfig.js?siteName=val'
  console.log('gbifDataConfig=>getSite called by module with metaURL query param siteName', metaSite);
  const httpSite = httpUrl.searchParams.get('siteName')
  console.log('gbifDataConfig=>getSite called with http query param siteName', httpSite);
  const storSite = await getStoredData('siteName', '', '');
  console.log('gbifDataConfig=>getSite retrieved localStorage siteName', storSite);
  var siteName = httpSite ? httpSite : (metaSite ? metaSite : storSite); //http route param 'siteName' overrides file param 'siteName' overrides localStorage siteName
  siteName = siteName ? siteName : 'val'; //if none specified, default to VAL
  console.log('gbifDataConfig=>getSite RESULTANT siteName:', siteName);
  return siteName;
}
export var siteName = await getSite(thisUrl);

const gbifApi = "https://api.gbif.org/v1";
const hostUrl = thisUrl.host;
const urlPath = thisUrl.pathname;
var urlRouts = urlPath.split('/'); //path contains route and file without host
console.log('gbifDataConfig=>urlRouts', urlRouts);
//WordPress use routes to pages, defined by the user. See eg. page-species-explorer-2022.php. etc.
var baseRoute = '/'; //Default. VAL WordPress has no baseRoute beyond host. Endpoints are routes mapped to pages within WordPress.
var homeEnd = '';
var exploreEnd = 'gbif-explorer'; //occurrences
var resultsEnd = 'gbif-species-explorer';
var profileEnd = 'species-profile';
var literatEnd = 'gbif-literature';
var publishEnd = 'gbif-publishers';
if (hostUrl.includes('vtatlasoflife.org') || hostUrl.includes('localhost')) { //test sites use html for endpoints and has site-specific routing
  baseRoute = urlRouts.splice(0, urlRouts.length-1).join('/'); //remove the html file from the route and use what's left to build URLs for page links in code
  homeEnd = '_index.html';
  exploreEnd = '_occurrences.html';
  resultsEnd = '_species.html';
  profileEnd = '_profile.html';
  literatEnd = '_literature.html';
  publishEnd = '_publishers.html';
}
baseRoute = baseRoute.replace('VAL_Species_Page', ''); //Sp Page includes this file to get paths. Remove it from baseRoute to allow link to find VAL_Data_Explorers
if (!baseRoute.endsWith('/')) {baseRoute += '/';}
const homeUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${homeEnd}`;
const exploreUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${exploreEnd}`;
const resultsUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${resultsEnd}`;
const profileUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${profileEnd}`;
const literatUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${literatEnd}`;
const publishUrl = `${thisUrl.protocol}//${hostUrl}${baseRoute}${publishEnd}`;
console.log('gbifDataConfig=>hostUrl', hostUrl);
console.log('gbifDataConfig=>urlPath', urlPath);
console.log('gbifDataConfig=>baseRoute', baseRoute);
console.log('gbifDataConfig=>exploreUrl', exploreUrl);
console.log('gbifDataConfig=>resultsUrl', resultsUrl);
console.log('gbifDataConfig=>profileUrl', profileUrl);
console.log('gbifDataConfig=>literatUrl', literatUrl);
console.log('gbifDataConfig=>publishUrl', publishUrl);
//const allColumns = ['key','nubKey','canonicalName','scientificName','vernacularName','rank','taxonomicStatus','synonym','parentKey','parent','occurrences','images','childTaxa','iconImage'];
const columns = ['canonicalName','vernacularNames','rank','taxonomicStatus','childTaxa','parentTaxa','iconImage','occurrences']; //these are the columns that will be shown
const columNames = {
  'key':'Dataset Key',
  'nubKey':'Backbone Key',
  'parentKey':'Parent Key',
  'scientificName': 'Scientific Name',
  'canonicalName':'Taxon',
  'childTaxa': 'Child Taxa',
  'vernacularNames':'Common Names',
  'vernacularName':'Common Name',
  'rank':'Rank',
  'taxonomicStatus':'Status',
  'parent':'Parent Taxon',
  'parentTaxa': 'Parent Taxa',
  'higherClassificationMap':'Parent Taxa',
  'iconImage': 'Image',
  'occurrences':'Occurrences',
  'images':'Images',
  'family':'Family',
  'genus':'Genus',
  'species':'Species',
  'grank':'Global Rank',
  'srank':'State Rank',
  'sgcn':'SGCN',
  'iucn':'IUCN'
};
const drillRanks = ['GENUS','SPECIES','SUBSPECIES','VARIETY','FORM']; //ranks that allow occurrence search drill-downs for non-GBIF backbone taxa
const ranksPage = 'https://help.natureserve.org/biotics/content/record_management/Element_Files/Element_Tracking/ETRACK_Definitions_of_Heritage_Conservation_Status_Ranks.htm';
const config = {
  val: { //Vermont Atlas of Life
    atlasPlace: 'Vermont',
    atlasName: 'Vermont Atlas of Life',
    atlasAbbrev: 'VAL',
    atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
    helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
    helpWidgetId: 62000000631,
    backgroundImageUrl: { //This idea was a failure. This web design is done within WP by Dadra.
      small: 'https://val.vtecostudies.org/wp-content/themes/val/images/vermont-panorama-small.jpg',
      medium: 'https://val.vtecostudies.org/wp-content/themes/val/images/vermont-panorama-medium.jpg',
      large: 'https://val.vtecostudies.org/wp-content/themes/val/images/vermont-panorama-large.jpg',
      default: 'https://val.vtecostudies.org/wp-content/themes/val/images/vermont-panorama-large.jpg'
      },
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: 'https://hp-vtatlasoflife.gbif.org',
    inatProject: 'inaturalist-vermont',
    inatPlaceId: 47,
    gbifApi: gbifApi,
    gadmGid: 'USA.46_1', //'Vermont' GADM administrative bounding region
    speciesDatasetKey: '0b1735ff-6a66-454b-8686-cae1cbc732a2',
    speciesFilter: 'datasetKey=0b1735ff-6a66-454b-8686-cae1cbc732a2', //this replaces the above in speciesSearch so it can be something else
    publishingOrgKey: 'b6d09100-919d-4026-b35b-22be3dae7156', //VCE key
    occurrenceDatasetKey: '', //New idea from eButterfly config NOT implemented yet
    occurrenceFilter: 'gadm_gid=USA.46_1',
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'taxonSrank',
    mapSettings: {
      lat: 43.858297,
      lng: -72.446594,
      zoom: 7.75
    },
    rootRank: 'KINGDOM', //the starting view in the species explorer
    rootPredicate: {
      type: 'or',
      predicates: [
        // first include occurrences from the Country and Region that do not have coordinates
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "country",
              "value": "US"
            },
            {
              "type": "in",
              "key": "stateProvince", // state province is a free text field, but this is a good start I would think
              "values": [
                "vermont",
                "vermont (state)"
              ]
            },
            {
              "type": "equals",
              "key": "hasCoordinate",
              "value": false
            },
            {
              "type": "equals",
              "key": "occurrenceStatus",
              "value": "PRESENT"
            }
          ]
        },
        // then include data having coordinates that has the correct GADM code
        {
            "type": "and",
            "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA.46_1"
            },
            {
              "type": "equals",
              "key": "occurrenceStatus",
              "value": "PRESENT"
            }
          ]
        }
      ]
    }
  },

  /*
  Martha's Vineyard Occurrence Queries (used below and to generate species list):
  https://www.gbif.org/occurrence/map?has_geospatial_issue=false&geometry=POLYGON((-70.88803 41.35236,-70.82729 41.20741,-70.69115 41.31884,-70.4219 41.3302,-70.41887 41.41874,-70.59434 41.51395,-70.88803 41.35236))
  https://www.gbif.org/occurrence/search?country=US&locality=MARTHA%27S%20VINEYARD&advanced=1&has_coordinate=FALSE
  */
  mval: { //Martha's Vineyard Atlas of Life
    atlasPlace: 'Marthas Vineyard',
    atlasName: 'Marthas Vineyard Atlas of Life',
    atlasAbbrev: 'MVAL',
    atlasAdmin: 'MA', //the administrative governing region that sets regional species listing
    helpDeskUrl: false,
    helpWidgetId: false,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: 'martha-s-vineyard-atlas-of-life',
    inatPlaceId: 142435,
    gbifApi: gbifApi,
    gadmGid: 'USA.22.4_1', //'Dukes County, MA' GADM administrative bounding region
    speciesDatasetKey: '298a29ef-a66a-4330-93a1-ea59482e25d9', //Martha's Vineyard Regional Species List Dataset Key
    speciesFilter: 'datasetKey=298a29ef-a66a-4330-93a1-ea59482e25d9', //this replaces the above in speciesSearch
    publishingOrgKey: false, //MVAL is not a GBIF Publisher. Yet.
    occurrenceDatasetKey: '', //New idea from eButterfly config NOT implemented yet
    occurrenceFilter: 'geometry=POLYGON((-70.88803 41.35236,-70.82729 41.20741,-70.69115 41.31884,-70.4219 41.3302,-70.41887 41.41874,-70.59434 41.51395,-70.88803 41.35236))',
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'statusMVAL',
    mapSettings: {
      lat: 41.4,
      lng: -70.6,
      zoom: 11
    },
    rootRank: 'KINGDOM', //the starting view in the species explorer
    rootPredicate: {
      type: 'or',
      predicates: [
        // first include occurrences from the Country and Region that do not have coordinates
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "country",
              "value": "US"
            },
            {
              "type": "in",
              "key": "locality",
              "values": [
                "Marthas Vineyard",
                "Martha's Vineyard"
              ]
            },
            {
              "type": "equals",
              "key": "hasCoordinate",
              "value": false
            }
          ]
        }
        ,{
          "type": "and",
          "predicates": [
            {
              "type": "within"
              //GBIF data-widgets use "key", "value"
              ,"key": "geometry"
              ,"value": "POLYGON((-70.88803 41.35236,-70.82729 41.20741,-70.69115 41.31884,-70.4219 41.3302,-70.41887 41.41874,-70.59434 41.51395,-70.88803 41.35236))"
              //GBIF v1 API uses just "geometry", but don't add it here - it crashes the gbif-data-widget. Handled in 
              //,"geometry": "POLYGON((-70.88803 41.35236,-70.82729 41.20741,-70.69115 41.31884,-70.4219 41.3302,-70.41887 41.41874,-70.59434 41.51395,-70.88803 41.35236))"
            }
          ]
        }
      ]
    }
  },
/*
  fieldMuseum: { //Chicago Field Museum
    atlasPlace: 'Field Museum',
    atlasName: 'Field Museum Atlas',
    atlasAbbrev: 'FMA',
    atlasAdmin: 'IL', //the administrative governing region that sets regional species listing
    helpDeskUrl: false,
    helpWidgetId: false,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: false,
    inatPlaceId: false,
    gbifApi: gbifApi,
    gadmGid: '', // World GADM administrative bounding region?
    speciesDatasetKey: 'ad8da44f-646f-4244-a6d0-5d1085ec6984', //FMA Species Dataset Key has been removed
    speciesFilter: 'datasetKey=ad8da44f-646f-4244-a6d0-5d1085ec6984', //this replaces the above in speciesSearch
    publishingOrgKey: '7b8aff00-a9f8-11d8-944b-b8a03c50a862', //FMA publ key
    occurrenceDatasetKey: '', //New idea from eButterfly config NOT implemented yet
    occurrenceFilter: 'publishing_org=7b8aff00-a9f8-11d8-944b-b8a03c50a862',
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: false,
    mapSettings: {
      lat: 41.885,
      lng: -87.636,
      zoom: 2
    },
    rootRank: 'KINGDOM', //the starting view in the species explorer
    rootPredicate: {
      type: 'or',
      predicates: [
        // include data for publishing_org=7b8aff00-a9f8-11d8-944b-b8a03c50a862
        {
          "type": "equals",
          "key": "publishingOrg",
          "value": "7b8aff00-a9f8-11d8-944b-b8a03c50a862"
        }
      ]
    }
  },

  eButterfly: { //eButterfly datasets demo - constrained by eB dataset keys, species and occurrence, and no geographic bounding-box
    atlasPlace: 'eButterfly',
    atlasName: 'eButterfly Atlas',
    atlasAbbrev: 'eBA',
    atlasAdmin: false, //the administrative governing region that sets regional species listing
    helpDeskUrl: false,
    helpWidgetId: false,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: false,
    inatPlaceId: false,
    gbifApi: gbifApi,
    gadmGid: false, //leave blank if N/A
    speciesDatasetKey: 'afff5f4d-742e-4db0-b750-6766306f3a0a', //Ebutterfly Species Dataset Key?
    //speciesFilter: 'datasetKey=afff5f4d-742e-4db0-b750-6766306f3a0a',
    speciesFilter: 'higherTaxonKey=6953&higherTaxonKey=5473&higherTaxonKey=7017&higherTaxonKey=9417&higherTaxonKey=5481&higherTaxonKey=1933999', //Filter to use if not speciesDatasetKey
    publishingOrgKey: false, //leave blank if N/A VCE is publisher of eButterfly datasets
    occurrenceDatasetKey: 'cf3bdc30-370c-48d3-8fff-b587a39d72d6', //New idea from eButterfly config NOT implemented yet
    occurrenceFilter: '', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: false,
    mapSettings: {
      lat: 41.885,
      lng: -87.636,
      zoom: 2
    },
    rootRank: 'FAMILY', //the starting view in the species explorer
    rootPredicate: {
      type: 'or',
      predicates: [
        // include data for 
        {
          "type": "equals",
          "key": "datasetKey",
          "value": "cf3bdc30-370c-48d3-8fff-b587a39d72d6"
        }
      ]
    }
  },
*/
  wwButterfly: { //eButterfly Worldwide demo - constrained by 6 butterfly families and no geographic bounding-box
    atlasPlace: 'eButterfly World',
    atlasName: 'eButterfly Atlas World Wide',
    atlasAbbrev: 'eBW',
    atlasAdmin: false, //the administrative governing region that sets regional species listing
    helpDeskUrl: false,
    helpWidgetId: false,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: false,
    inatPlaceId: false,
    gbifApi: gbifApi,
    gadmGid: false, //leave blank if worldwide
    //speciesDatasetKey: 'f9d29a0f-b64f-40ee-8061-471a3c15a0fc', //Species Dataset Key
    //speciesFilter: 'datasetKey=f9d29a0f-b64f-40ee-8061-471a3c15a0fc',
    speciesDatasetKey: false,
    speciesFilter: 'taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999', //Filter to use if not speciesDatasetKey
    publishingOrgKey: false, //leave blank if N/A
    occurrenceDatasetKey: '', //New idea NOT implemented yet
    occurrenceFilter: '', //'taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: false,
    mapSettings: {
      lat: 41.885,
      lng: -87.636,
      zoom: 2
    },
    rootRank: 'FAMILY', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        // include data for taxonKeys in superFamily Papilionoidea, which can't be used on its own,
        // so include all families:
        //  Hesperiidae: https://www.gbif.org/species/6953
        //  Lycaenidae: https://www.gbif.org/species/5473
        //  Nymphalidae: https://www.gbif.org/species/7017
        //  Papilionidae: https://www.gbif.org/species/9417
        //  Pieridae: https://www.gbif.org/species/5481
        //  Riodinidae: https://www.gbif.org/species/1933999
        //
        {"type":"equals", "key":"taxonKey", "value":"6953"},
        {"type":"equals", "key":"taxonKey", "value":"5473"},
        {"type":"equals", "key":"taxonKey", "value":"7017"},
        {"type":"equals", "key":"taxonKey", "value":"9417"},
        {"type":"equals", "key":"taxonKey", "value":"5481"},
        {"type":"equals", "key":"taxonKey", "value":"1933999"}
      //
      //  {
      //    "type": "in",
      //    "key": "taxonKey",
      //    "values": [
      //      "6953",
      //      "5473",
      //      "7017",
      //      "9417",
      //      "5481",
      //      "1933999"
      //    ]
      //  }
      //
      ]
    }
  },

  vtButterflies: { //VT Checklist of Butterflies
    atlasPlace: 'Vermont Butterfly',
    atlasName: 'VT Checklist of Butterflies',
    atlasAbbrev: 'VAL',
    atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
    helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
    helpWidgetId: 62000000631,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: 'inaturalist-vermont',
    inatPlaceId: 47,
    gbifApi: gbifApi,
    gadmGid: 'USA.46_1', //leave blank if N/A
    speciesDatasetKey: '73eb16f0-4b06-4347-8069-459bc2d96ddb', //Species Dataset Key
    speciesFilter: 'datasetKey=73eb16f0-4b06-4347-8069-459bc2d96ddb', //Filter to use for species
    publishingOrgKey: false,
    occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'taxonSrank',
    mapSettings: {
      lat: 43.858297,
      lng: -72.446594,
      zoom: 7.75
    },
    rootRank: 'FAMILY', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA.46_1"
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "6953",
                "5473",
                "7017",
                "9417",
                "5481"  //1933999-Riodinidae does not exist in Vermont
              ]
            }
          ]
        },
        {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "6953",
              "5473",
              "7017",
              "9417",
              "5481"  //1933999-Riodinidae does not exist in Vermont
            ]
          }
        ]
      }
    ]
    }
  },
  vtMammals: { //Checklist of Vermont Mammals
    atlasPlace: 'Vermont Mammal',
    atlasName: 'VT Checklist of Mammals',
    atlasAbbrev: 'VAL',
    atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
    helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
    helpWidgetId: 62000000631,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: 'inaturalist-vermont',
    inatPlaceId: 47,
    gbifApi: gbifApi,
    gadmGid: 'USA.46_1', //leave blank if N/A
    speciesDatasetKey: 'f2faaa4c-74e9-457a-8265-06ef5cc73626', //Species Dataset Key
    speciesFilter: 'datasetKey=f2faaa4c-74e9-457a-8265-06ef5cc73626', //Filter to use for species
    publishingOrgKey: false,
    occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'taxonSrank',
    mapSettings: {
      lat: 43.858297,
      lng: -72.446594,
      zoom: 7.75
    },
    rootRank: 'ORDER', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA.46_1"
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "359",
              ]
            }
          ]
        },
        {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "359",
            ]
          }
        ]
      }
    ]
    }
  },
  //https://www.gbif.org/occurrence/search?country=US&has_coordinate=false&taxon_key=17&taxon_key=18&taxon_key=34&taxon_key=73&taxon_key=94&taxon_key=95&taxon_key=96&taxon_key=7501587&state_province=vermont&advanced=1
  //https://www.gbif.org/occurrence/search?gadm_gid=USA.46_1&taxon_key=17&taxon_key=18&taxon_key=34&taxon_key=73&taxon_key=94&taxon_key=95&taxon_key=96&taxon_key=7501587
  //Neocallimastigomycota Glomeromycota Basidiomycota Blastocladiomycota Chytridiomycota Ascomycota Zygomycota Microsporidia 
  vtFungi: { //Checklist of Vermont Macro Fungi
    atlasPlace: 'Vermont Fungi',
    atlasName: 'VT Fungi',
    atlasAbbrev: 'VAL',
    atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
    helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
    helpWidgetId: 62000000631,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: 'inaturalist-vermont',
    inatPlaceId: 47,
    gbifApi: gbifApi,
    gadmGid: 'USA.46_1', //leave blank if N/A
    speciesDatasetKey: '440956b7-3d27-4b6c-89a0-426aa9524ef3', //Species Dataset Key
    speciesFilter: 'datasetKey=440956b7-3d27-4b6c-89a0-426aa9524ef3', //'higherTaxonKey=160776583&higherTaxonKey=160780279',
    publishingOrgKey: false,
    literatureFilters: ['Neocallimastigomycota', 'Glomeromycota', 'Basidiomycota', 'Blastocladiomycota', 'Chytridiomycota', 'Ascomycota', 'Zygomycota', 'Microsporidia'],
    occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'taxonSrank',
    mapSettings: {
      lat: 43.858297,
      lng: -72.446594,
      zoom: 7.75
    },
    rootRank: 'PHYLUM', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA.46_1"
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "17",
                "18",
                "34",
                "73",
                "94",
                "95",
                "96",
                "7501587"
              ]
            }
          ]
        },
        {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "17",
              "18",
              "34",
              "73",
              "94",
              "95",
              "96",
              "7501587"
            ]
          }
        ]
      }
    ]
    }
  },
  //VT Bees: 950853df-adf7-4c5a-b955-266bb6a194df
  vtBees: { //Checklist of Vermont Bees
    atlasPlace: 'Vermont Bees',
    atlasName: 'VT Bees',
    atlasAbbrev: 'VAL',
    atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
    helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
    helpWidgetId: 62000000631,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: 'vermont-wild-bee-survey',
    inatPlaceId: 47, //this used to query iNat observers
    gbifApi: gbifApi,
    gadmGid: 'USA.46_1', //leave blank if N/A
    speciesDatasetKey: '950853df-adf7-4c5a-b955-266bb6a194df',
    speciesFilter: 'datasetKey=950853df-adf7-4c5a-b955-266bb6a194df',
    publishingOrgKey: false,
    literatureFilters: ['Apoidea','Anthophila','Andrenidae','Apidae','Colletidae','Halictidae','Megachilidae','Melittidae'],
    occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns, 
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'taxonSrank',
    mapSettings: {
      lat: 43.858297,
      lng: -72.446594,
      zoom: 7.75
    },
    rootRank: 'FAMILY', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA.46_1"
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "7901", //Andrenidae
                "4334", //Apidae
                "7905", //Colletidae
                "7908", //Halictidae
                "7911", //Megachilidae
                "4345" //Melittidae
              ]
            }
          ]
        },
        {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "7901", //Andrenidae
              "4334", //Apidae
              "7905", //Colletidae
              "7908", //Halictidae
              "7911", //Megachilidae
              "4345" //Melittidae
            ]
        }
        ]
      }
    ]
    }
  },
  //https://www.gbif.org/occurrence/download?gadm_gid=USA&taxon_key=7901&taxon_key=4334&taxon_key=7905&taxon_key=7908&taxon_key=7911&taxon_key=4345&taxon_key=7916&occurrence_status=present
  //https://www.gbif.org/occurrence/download?country=US&has_coordinate=false&taxon_key=7901&taxon_key=4334&taxon_key=7905&taxon_key=7908&taxon_key=7911&taxon_key=4345&taxon_key=7916&occurrence_status=present
  usBees: { //Checklist of United States Bees
    atlasPlace: 'United States Bees',
    atlasName: 'US Bees',
    atlasAbbrev: 'USB',
    atlasAdmin: 'US', //the administrative governing region that sets regional species listing
    helpDeskUrl: false,
    helpWidgetId: false,
    backgroundImageUrl: {},
    thisUrl: thisUrl,
    hostUrl: hostUrl,
    homeUrl: homeUrl,
    exploreUrl: exploreUrl,
    resultsUrl: resultsUrl,
    profileUrl: profileUrl,
    literatUrl: literatUrl,
    publishUrl: publishUrl,
    gbifPortal: false,
    inatProject: false,
    inatPlaceId: 47, //this used to query iNat observers
    gbifApi: gbifApi,
    gadmGid: 'USA', //leave blank if N/A
    speciesDatasetKey: 'a5abc760-57e0-42ce-a6f3-c28960a7167b', //can be left blank if speciesFilter is valid
    speciesFilter: 'datasetKey=a5abc760-57e0-42ce-a6f3-c28960a7167b', //'higherTaxonKey=220770051', //Hymenoptera
    publishingOrgKey: false,
    literatureFilters: ['Andrenidae','Apidae','Colletidae','Halictidae','Megachilidae','Melittidae','Stenotritidae'],
    occurrenceFilter: 'gadm_gid=USA', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
    columns: columns,
    columNames: columNames,
    drillRanks: drillRanks,
    downloadOccurrenceCounts: 1,
    conservationStatusName: 'IUCN',
    mapSettings: {
      lat: 40.75,
      lng: -100.0,
      zoom: 3.75
    },
    rootRank: 'FAMILY', //the starting view in the species explorer
    rootPredicate: {
      type: 'or', //currently the only supported type
      predicates: [
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "gadmGid",
              "value": "USA"
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "7901", //Andrenidae
                "4334", //Apidae
                "7905", //Colletidae
                "7908", //Halictidae
                "7911", //Megachilidae
                "4345", //Melittidae
                "7916"  //Stenotritidae
              ]
            }
          ]
        },
        {
          "type": "and",
          "predicates": [
            {
              "type": "equals",
              "key": "country",
              "value": "US"
            },
            {
              "type": "equals",
              "key": "hasCoordinate",
              "value": false
            },
            {
              "type": "in",
              "key": "taxonKey",
              "values": [
                "7901", //Andrenidae
                "4334", //Apidae
                "7905", //Colletidae
                "7908", //Halictidae
                "7911", //Megachilidae
                "4345", //Melittidae
                "7916"  //Stenotritidae
              ]
            }
          ]
        }
      ]
    }
  },
//VT LadyBeetles: 97297349-0864-4e3a-b6e1-1a80a0594e00
vtLadyBeetles: { //Checklist of Vermont Lady Beetles
  atlasPlace: 'Vermont Lady Beetles',
  atlasName: 'VT Lady Beetles',
  atlasAbbrev: 'VAL',
  atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
  helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
  helpWidgetId: 62000000631,
  backgroundImageUrl: {},
  thisUrl: thisUrl,
  hostUrl: hostUrl,
  homeUrl: homeUrl,
  exploreUrl: exploreUrl,
  resultsUrl: resultsUrl,
  profileUrl: profileUrl,
  literatUrl: literatUrl,
  publishUrl: publishUrl,
  gbifPortal: false,
  inatProject: 'inaturalist-vermont',
  inatPlaceId: 47, //this used to query iNat observers
  gbifApi: gbifApi,
  gadmGid: 'USA.46_1', //leave blank if N/A
  speciesDatasetKey: '97297349-0864-4e3a-b6e1-1a80a0594e00',
  speciesFilter: 'datasetKey=97297349-0864-4e3a-b6e1-1a80a0594e00',
  publishingOrgKey: false,
  literatureFilters: [],
  occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
  columns: columns,
  columNames: columNames,
  drillRanks: drillRanks,
  downloadOccurrenceCounts: 1,
  conservationStatusName: 'taxonSrank',
  mapSettings: {
    lat: 43.858297,
    lng: -72.446594,
    zoom: 7.75
  },
  rootRank: 'GENUS', //the starting view in the species explorer
  rootPredicate: {
    type: 'or', //currently the only supported type
    predicates: [
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "gadmGid",
            "value": "USA.46_1"
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "7782" //Coccinelidae
            ]
          }
        ]
      },
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "7782" //Coccinelidae
            ]
          }
        ]
      }
    ]
  }
},
vtPlants: {
  atlasPlace: 'Vermont Plants',
  atlasName: 'VT Plants',
  atlasAbbrev: 'VAL',
  atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
  helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
  helpWidgetId: 62000000631,
  backgroundImageUrl: {},
  thisUrl: thisUrl,
  hostUrl: hostUrl,
  homeUrl: homeUrl,
  exploreUrl: exploreUrl,
  resultsUrl: resultsUrl,
  profileUrl: profileUrl,
  literatUrl: literatUrl,
  publishUrl: publishUrl,
  gbifPortal: false,
  inatProject: 'inaturalist-vermont',
  inatPlaceId: 47, //this used to query iNat observers
  gbifApi: gbifApi,
  gadmGid: 'USA.46_1', //leave blank if N/A
  speciesDatasetKey: 'cdfc1cef-177b-45a0-8ba6-c686cadae556',
  speciesFilter: 'datasetKey=cdfc1cef-177b-45a0-8ba6-c686cadae556',
  publishingOrgKey: false,
  literatureFilters: [],
  occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
  columns: columns,
  columNames: columNames,
  drillRanks: drillRanks,
  downloadOccurrenceCounts: 1,
  conservationStatusName: 'taxonSrank',
  mapSettings: {
    lat: 43.858297,
    lng: -72.446594,
    zoom: 7.75
  },
  rootRank: 'PHYLUM', //the starting view in the species explorer
  rootPredicate: {
    type: 'or',
    predicates: [
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "gadmGid",
            "value": "USA.46_1"
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              6
            ]
          }
        ]
      },
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince",
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              6
            ]
          }
        ]
      }
    ]
  }
},
vtOrthoptera: { //Checklist of Vermont Orthoptera
  atlasPlace: 'Vermont Orthoptera',
  atlasName: 'VT Orthoptera',
  atlasAbbrev: 'VAL', //very short abbreviation for eg. stats above phenology charts
  atlasAdmin: 'VT', //the administrative governing region that sets regional species listing
  helpDeskUrl: 'https://vtatlasoflife.freshdesk.com/support/tickets/new',
  helpWidgetId: 62000000631,
  backgroundImageUrl: {},
  thisUrl: thisUrl,
  hostUrl: hostUrl,
  homeUrl: homeUrl,
  exploreUrl: exploreUrl,
  resultsUrl: resultsUrl,
  profileUrl: profileUrl,
  literatUrl: literatUrl,
  publishUrl: publishUrl,
  gbifPortal: false,
  inatProject: 'inaturalist-vermont',
  inatPlaceId: 47, //this used to query iNat observers
  gbifApi: gbifApi,
  gadmGid: 'USA.46_1', //leave blank if N/A
  speciesDatasetKey: '92d38ab4-155e-4efc-977f-f5a64af82c32',
  speciesFilter: 'datasetKey=92d38ab4-155e-4efc-977f-f5a64af82c32',
  publishingOrgKey: false,
  literatureFilters: [],
  occurrenceFilter: 'gadm_gid=USA.46_1', //leave blank if scope is world - this is used in speciesExplorer for each taxonKey - it can be geographic limit or a publishingOrg
  columns: columns,
  columNames: columNames,
  drillRanks: drillRanks,
  downloadOccurrenceCounts: 1,
  conservationStatusName: 'taxonSrank',
  mapSettings: {
    lat: 43.858297,
    lng: -72.446594,
    zoom: 7.75
  },
  rootRank: 'FAMILY', //the starting view in the species explorer
  rootPredicate: { //constrains views of occurrences in GBIF data widget
    type: 'or', //currently the only supported type
    predicates: [
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "gadmGid",
            "value": "USA.46_1"
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "1458" //Orthoptera
            ]
          }
        ]
      },
      {
        "type": "and",
        "predicates": [
          {
            "type": "equals",
            "key": "country",
            "value": "US"
          },
          {
            "type": "in",
            "key": "stateProvince", // state province is a free text field, but this is a good start I would think
            "values": [
              "vermont",
              "vermont (state)"
            ]
          },
          {
            "type": "equals",
            "key": "hasCoordinate",
            "value": false
          },
          {
            "type": "in",
            "key": "taxonKey",
            "values": [
              "1458" //Orthoptera
            ]
          }
        ]
      }
    ]
  }
}

} //end of config

export let dataConfig = config[siteName];
dataConfig.ranksPage = ranksPage; //help reference page for conservation ranks
export let hostConfig = {
  parentUrl: parentUrl,
  thisUrl: thisUrl,
  hostUrl: hostUrl,
  homeUrl: homeUrl,
  exploreUrl: exploreUrl,
  resultsUrl: resultsUrl,
  profileUrl: profileUrl,
  literatUrl: literatUrl,
  publishUrl: publishUrl
}
export let embedConfig = {
  columns: ['family', 'canonicalName','vernacularName','grank','srank','sgcn','iucn'],
  rootRank: ['SPECIES'],
  taxonomicStatus: ['ACCEPTED'],
  limit: 500,
  columNames: {
    canonicalName: 'Scientific Name'
  }
}

/*
  Parse rootPredicate into an array of http query parameters for combined and iterative calls to API here
  The 'xClud' flag means 'exclude taxon filters'
  NOTE: AND and IN queries are appended to lists of &-delimited contiguous queries instead of separate array-elements
  NOTE: Queries are NOT prefixed by ?
*/
export function predicateToQueries(rootPredicate=dataConfig.rootPredicate, xClud=false) {
  let qrys = [];
  if ('or' == rootPredicate.type.toLowerCase()) {
    for (var topIdx=0; topIdx<rootPredicate.predicates.length;topIdx++) {
      let topEle = rootPredicate.predicates[topIdx];
      //alert(`rootPredicate | ${JSON.stringify(topEle)} | ${topIdx}`);
      if (topEle.predicates) { //nested predicate object
        let qry = '';
        for (var subIdx=0; subIdx<topEle.predicates.length; subIdx++) {
          let subEle = topEle.predicates[subIdx];
          console.log(`predicateToQueries | subPredicate | ${JSON.stringify(subEle)} | ${subIdx}`);
          if ('or' == topEle.type.toLowerCase()) {
            if ('in' == subEle.type.toLowerCase()) {
              for (var valIdx=0; valIdx<subEle.values.length; valIdx++) {
                if (includeFilter(xClud, subEle.key, subEle.values[valIdx])) {
                  //qrys.push(`${subEle.key}=${subEle.values[valIdx]}`); //add multiple query array-elements for sub-predicates' sub-values
                  qry += `${subEle.key}=${subEle.values[valIdx]}&`; //multiple ANDs for the same key treated as ORs string sub-predicates' values together as '&' values in one query
                }
              }
            } else {
              if (includeFilter(xClud, subEle.key, subEle.value)) {
                qrys.push(`${subEle.key}=${subEle.value}`); //add multiple query array-elements for sub-predicates, OR conditions
              }
            }
          } else if ('and' == topEle.type.toLowerCase()) {
            if ('in' == subEle.type.toLowerCase()) {
              for (var valIdx=0; valIdx<subEle.values.length; valIdx++) {
                if (includeFilter(xClud, subEle.key, subEle.values[valIdx])) {
                  qry += `${subEle.key}=${subEle.values[valIdx]}&`; //string sub-predicates' values together as '&' values in one query
                }
              }
            } else {
              if (includeFilter(xClud, subEle.key, subEle.value)) {
                qry += `${subEle.key}=${subEle.value}&`; //string sub-predicates together as '&' values in one query
              }
            }
          }
        }
        if (qry) {qrys.push(qry);} //add single query array-element for 'and' sub-predicate
      } else {
        console.log(`predicateToQueries topEle type:${topEle.type} key:${topEle.key} values:`);
        if ('in' == topEle.type.toLowerCase()) {
          console.log(topEle.values);
          let qry = '';
          for (var valIdx=0; valIdx<topEle.values.length; valIdx++) {
            if (includeFilter(xClud, topEle.key, topEle.values[valIdx])) {
              qry += `${topEle.key}=${topEle.values[valIdx]}&`; //multiple ANDs for the same key treated as ORs string sub-predicates' values together as '&' values in one query
            }
          }
          qrys.push(qry);
        } else {
        console.log(topEle.value);
        if (includeFilter(xClud, topEle.key, topEle.value)) {
          qrys.push(`${topEle.key}=${topEle.value}`);
        }
      }
    }
    }
  }
  return qrys;
}

//xClud can be true/false or named searchTerms like 'taxonKey|scientificName' 
function includeFilter(xClud, key, value) {
  let xc = false;
  if (typeof(xClud) == "boolean") {xc = (xClud && (key.includes('taxonKey') || key.includes('scientificName')));}
  else {xc = (xClud && (xClud.includes(key)));} //xClud can be concatenated field names like 'taxonKey|taxonName'
  if (xc) {
    console.log(`predicateToQueries excluded ${key}=${value}`);
  }
  return xc ? false : true;  
}