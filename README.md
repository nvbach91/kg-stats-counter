# KG stats counter

The scripts retrieves a list of ontologies (name, acronym, URI) and calculate the number of classes, individuals, properties in each of them.

## How to use
- clone this repo `git clone https://github.com/nvbach91/kg-stats-counter.git`
- install via `npm install`
- run `node lov-stats.js`, `node biomed-stats.js`, `node bioportal.js`
- the output of each script should be 3 files
    - `...-ontologies.json` - a list of ontologies and their names
    - `...-results.json` - a JSON string containing the results
    - `...-results.csv` - the same results in CSV

