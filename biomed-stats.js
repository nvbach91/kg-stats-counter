const axios = require('axios');
const Promise = require('bluebird');
const fs = require('fs');
let out = [];
const runQuery = (query) => {
    return axios({ 
        url: 'https://fcp.vse.cz/blazegraph/namespace/biomed/sparql', 
        method: 'post',
        data: `query=${encodeURIComponent(query)}`, 
        headers: {
            "accept": "application/sparql-results+json,*/*;q=0.9",
            "accept-language": "en,fr-FR;q=0.9,fr;q=0.8,vi;q=0.7",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        }
    });
};
const getVocabList = () => {
    return runQuery(`
        PREFIX vann:    <http://purl.org/vocab/vann/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dcterm: <http://purl.org/dc/terms/>
        PREFIX dc: <http://purl.org/dc/elements/1.1/>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        SELECT * {
          ?vocabURI a owl:Ontology .
          OPTIONAL {
            ?vocabURI rdfs:label|dc:title|dcterm:title ?vocabLabel .
          }
          OPTIONAL {
            ?vocabURI vann:preferredNamespacePrefix ?vocabPrefix.
          }
        }
    `);
};
const queryPrefixes = `
PREFIX owl:      <http://www.w3.org/2002/07/owl#>
PREFIX rdf:      <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:     <http://www.w3.org/2000/01/rdf-schema#>
`;

const createVocabQueries = (vocabIri) => ({ ci: `
${queryPrefixes}
SELECT (COUNT (DISTINCT ?class) AS ?nClass) (COUNT (DISTINCT ?ind) AS ?nInd) FROM <${vocabIri}> WHERE {
    {
        VALUES ?c { owl:Class rdf:Class rdfs:Class } .
        ?class a ?c .
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        VALUES ?p { rdf:subClassOf rdf:subClass rdfs:subClassOf rdfs:subClass owl:subClassOf owl:subClass }
        ?class ?p []
        OPTIONAL {
            ?ind a ?class .
        }
    }
}
`, op: `
${queryPrefixes}
SELECT (COUNT (DISTINCT ?op) AS ?nOP) FROM <${vocabIri}> WHERE {
    ?op a owl:ObjectProperty .
}
`, dp: `
${queryPrefixes}
SELECT (COUNT (DISTINCT ?dp) AS ?nDP) FROM <${vocabIri}> WHERE {
    ?dp a owl:DatatypeProperty .
}
`, ap: `
${queryPrefixes}
SELECT (COUNT (DISTINCT ?ap) AS ?nAP) FROM <${vocabIri}> WHERE {
    ?ap a owl:AnnotationProperty .
}
`, rp: `
${queryPrefixes}
SELECT (COUNT (DISTINCT ?rp) AS ?nRP) FROM <${vocabIri}> WHERE {
    ?rp a rdf:Property .
}
`});
let done = 0;
getVocabList().then((resp) => {
    fs.writeFileSync('biomed-ontologies.json', JSON.stringify(resp.data, null, 2));
    return Promise.each(resp.data.results.bindings, (binding) => {
        if (binding.vocabURI.value.includes('NCBITAXON')) return false;
        const queries = createVocabQueries(binding.vocabURI.value);
        const result = {
            vocabIri: binding.vocabURI.value,
            prefix: binding.vocabPrefix ? binding.vocabPrefix.value : '',
            label: binding.vocabLabel ? binding.vocabLabel.value.replace(/[\r\n]+/g, ' - ') : '',
        };
        return Promise.each(Object.keys(queries), (queryKey) => {
            console.log(done++, 'Running query for', queryKey, binding.vocabURI.value);
            return runQuery(queries[queryKey]).then((resp) => {
                if (queryKey === 'ci') {
                    result.nClasses = resp.data.results.bindings[0].nClass.value;
                    result.nIndividuals = resp.data.results.bindings[0].nInd.value;
                } else if (queryKey === 'op') {
                    result.nOwlObjectProps = resp.data.results.bindings[0].nOP.value;
                } else if (queryKey === 'dp') {
                    result.nOwlDatatypeProps = resp.data.results.bindings[0].nDP.value;
                } else if (queryKey === 'ap') {
                    result.nOwlAnnotationProps = resp.data.results.bindings[0].nAP.value;
                } else if (queryKey === 'rp') {
                    result.nRdfProps = resp.data.results.bindings[0].nRP.value;
                }
            }).catch((e) => {
                console.log('Query failed', queryKey, binding.vocabURI.value);
                // console.log(e.response.status);
            });
        }).then(() => {
            out.push(result);
            // fs.writeFileSync('out.json', JSON.stringify(out, null, 2));
        });
    });
}).then(() => {
    // console.log(out);
    fs.writeFileSync('biomed-results.json', JSON.stringify(out, null, 2));
    let csv = 'vocabIri\tprefix\tlabel\tnClasses\tnIndividuals\tnOwlObjectProps\tnOwlDatatypeProps\tnOwlAnnotationProps\tnRdfProps';
    csv += '\n' + out.map((res) => `${res.vocabIri}\t${res.prefix}\t${res.label}\t${res.nClasses}\t${res.nIndividuals}\t${res.nOwlObjectProps}\t${res.nOwlDatatypeProps}\t${res.nOwlAnnotationProps}\t${res.nRdfProps}`).join('\n');
    fs.writeFileSync('biomed-results.csv', csv);
});