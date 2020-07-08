const axios = require('axios');
const Promise = require('bluebird');
const fs = require('fs');
let out = [];
const runQuery = (query) => {
    return axios.get(`http://sparql.bioontology.org/sparql/?csrfmiddlewaretoken=e4b2fe38ea5ff2a747fce10119916898&apikey=0cce06e6-bdbf-4c9f-b2ff-ecd5aaa72b13&output=json&kboption=ontologies&query=${encodeURIComponent(query)}`);
};
const getVocabList = () => {
    // return axios.get('http://data.bioontology.org/ontologies?apikey=0cce06e6-bdbf-4c9f-b2ff-ecd5aaa72b13');
    return runQuery(`
        PREFIX omv: <http://omv.ontoware.org/2005/05/ontology#>
        SELECT ?vocabURI ?vocabPrefix ?vocabLabel
        WHERE {
            ?ont <http://bioportal.bioontology.org/metadata/def/hasDataGraph> ?vocabURI .
            OPTIONAL {
                ?ont a omv:Ontology .
                OPTIONAL {
                    ?ont omv:acronym ?vocabPrefix ;
                }
                OPTIONAL {
                    ?ont omv:name ?vocabLabel .
                }
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
        ?class a owl:Class .
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class a rdf:Class .
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class a rdfs:Class .
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class owl:subClassOf []
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class owl:subClass []
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class rdf:subClassOf []
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class rdf:subClass []
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class rdfs:subClassOf []
        OPTIONAL {
            ?ind a ?class .
        }
    }
    UNION
    {
        ?class rdfs:subClass []
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
    fs.writeFileSync('bioportal-ontologies.json', JSON.stringify(resp.data, null, 2));
    return Promise.each(resp.data.results.bindings, (binding) => {
        const queries = createVocabQueries(binding.vocabURI.value);
        const result = {
            vocabIri: binding.vocabURI.value,
            prefix: binding.vocabPrefix ? binding.vocabPrefix.value : '',
            label: binding.vocabLabel ? binding.vocabLabel.value : ''
        };
        return Promise.each(Object.keys(queries), (queryKey) => {
            console.log(done++, 'Running query for', queryKey, binding.vocabURI.value);
            return runQuery(queries[queryKey]).then((resp) => {
                // console.log(queries[queryKey]);
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
                console.log(e.response.status, e.response.statusText);
                console.log(queries[queryKey]);
            });
        }).then(() => {
            out.push(result);
            console.log(result.nClasses, result.nIndividuals, result.nOwlObjectProps, result.nOwlDatatypeProps, result.nOwlAnnotationProps, result.nRdfProps);
            // fs.writeFileSync('out.json', JSON.stringify(out, null, 2));
        });
    });
}).then(() => {
    // console.log(out);
    fs.writeFileSync('bioportal-results.json', JSON.stringify(out, null, 2));
    let csv = 'vocabIri\tprefix\tlabel\tnClasses\tnIndividuals\tnOwlObjectProps\tnOwlDatatypeProps\tnOwlAnnotationProps\tnRdfProps';
    csv += '\n' + out.map((res) => `${res.vocabIri}\t${res.prefix}\t${res.label}\t${res.nClasses}\t${res.nIndividuals}\t${res.nOwlObjectProps}\t${res.nOwlDatatypeProps}\t${res.nOwlAnnotationProps}\t${res.nRdfProps}`).join('\n');
    fs.writeFileSync('bioportal-results.csv', csv);
});
