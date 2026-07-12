/**
 * RDF Serializers
 * Convert AIF graphs to RDF/XML, Turtle, and JSON-LD formats
 */

import { Writer } from "n3";
import { DataFactory } from "n3";
import type { AIFTriple } from "./ontologyTypes";
import * as CONST from "./constants";

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Serialize graph to RDF/XML format
 */
export function serializeToRDFXML(
  triples: AIFTriple[],
  namespaces: Record<string, string>
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rdf:RDF\n';
  
  // Add namespace declarations
  for (const [prefix, uri] of Object.entries(namespaces)) {
    xml += `  xmlns:${prefix}="${uri}"\n`;
  }
  xml += '>\n\n';

  // Group triples by subject
  const triplesBySubject = new Map<string, AIFTriple[]>();
  for (const triple of triples) {
    if (!triplesBySubject.has(triple.subject)) {
      triplesBySubject.set(triple.subject, []);
    }
    triplesBySubject.get(triple.subject)!.push(triple);
  }

  // Serialize each subject
  for (const [subject, subjectTriples] of triplesBySubject) {
    // Find rdf:type to determine element name
    const typeTriple = subjectTriples.find(t => t.predicate === CONST.RDF_TYPE);
    const elementName = typeTriple 
      ? compactURI(typeTriple.object, namespaces)
      : "rdf:Description";

    xml += `  <${elementName} rdf:about="${subject}">\n`;

    // Add properties
    for (const triple of subjectTriples) {
      if (triple.predicate === CONST.RDF_TYPE) continue; // Already used for element name

      const predicateName = compactURI(triple.predicate, namespaces);
      
      if (triple.objectType === "uri") {
        xml += `    <${predicateName} rdf:resource="${triple.object}" />\n`;
      } else {
        const datatypeAttr = triple.datatype ? ` rdf:datatype="${triple.datatype}"` : "";
        xml += `    <${predicateName}${datatypeAttr}>${escapeXML(triple.object)}</${predicateName}>\n`;
      }
    }

    xml += `  </${elementName}>\n\n`;
  }

  xml += '</rdf:RDF>';
  return xml;
}

/**
 * Serialize graph to Turtle format using n3 library
 */
export async function serializeToTurtle(
  triples: AIFTriple[],
  namespaces: Record<string, string>
): Promise<string> {
  const writer = new Writer({
    prefixes: namespaces,
  });

  // Add all triples using n3's DataFactory
  for (const triple of triples) {
    const subject = DataFactory.namedNode(triple.subject);
    const predicate = DataFactory.namedNode(triple.predicate);
    
    let object: any;
    if (triple.objectType === "uri") {
      // URI object
      object = DataFactory.namedNode(triple.object);
    } else {
      // Literal object with optional datatype
      if (triple.datatype) {
        object = DataFactory.literal(triple.object, DataFactory.namedNode(triple.datatype));
      } else {
        object = DataFactory.literal(triple.object);
      }
    }

    writer.addQuad(subject, predicate, object);
  }

  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Serialize graph to JSON-LD format
 */
export function serializeToJSONLD(
  triples: AIFTriple[],
  namespaces: Record<string, string>
): string {
  const context: Record<string, string> = {};
  for (const [prefix, uri] of Object.entries(namespaces)) {
    context[prefix] = uri;
  }

  // Group triples by subject
  const subjects = new Map<string, any>();

  for (const triple of triples) {
    if (!subjects.has(triple.subject)) {
      subjects.set(triple.subject, {
        "@id": triple.subject,
      });
    }

    const subject = subjects.get(triple.subject)!;
    const predicateName = compactURI(triple.predicate, namespaces);

    let value: any;
    if (triple.objectType === "uri") {
      value = { "@id": triple.object };
    } else {
      value = {
        "@value": triple.object,
      };
      if (triple.datatype) {
        value["@type"] = compactURI(triple.datatype, namespaces);
      }
    }

    // Add to subject (handle multiple values for same predicate)
    if (subject[predicateName]) {
      if (Array.isArray(subject[predicateName])) {
        subject[predicateName].push(value);
      } else {
        subject[predicateName] = [subject[predicateName], value];
      }
    } else {
      subject[predicateName] = value;
    }
  }

  const graph = Array.from(subjects.values());

  const jsonld = {
    "@context": context,
    "@graph": graph,
  };

  return JSON.stringify(jsonld, null, 2);
}

/**
 * Compact a full URI to prefixed form (e.g., http://...#Scheme -> aif:Scheme)
 */
function compactURI(uri: string, namespaces: Record<string, string>): string {
  for (const [prefix, namespace] of Object.entries(namespaces)) {
    if (uri.startsWith(namespace)) {
      return `${prefix}:${uri.substring(namespace.length)}`;
    }
  }
  return uri;
}

/**
 * Expand a prefixed URI to full form (e.g., aif:Scheme -> http://...#Scheme)
 */
export function expandURI(compactUri: string, namespaces: Record<string, string>): string {
  const colonIndex = compactUri.indexOf(":");
  if (colonIndex === -1) return compactUri;

  const prefix = compactUri.substring(0, colonIndex);
  const localName = compactUri.substring(colonIndex + 1);

  const namespace = namespaces[prefix];
  if (!namespace) return compactUri;

  return `${namespace}${localName}`;
}
