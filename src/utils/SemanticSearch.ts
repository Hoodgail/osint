import { TfIdf, SentenceTokenizer } from 'natural';
import { compareTwoStrings } from 'string-similarity';

export class SemanticSearch {

     private readonly tfidf = new TfIdf();

     constructor(
          readonly text: string[],
          private readonly sections: string[] = text.flatMap(fragment => this.splitIntoSections(fragment))
     ) {

          this.sections.forEach((section, index) =>

               this.tfidf.addDocument(section, index)

          );
     }

     splitIntoSections(text: string) {

          const tokenizer = new SentenceTokenizer();

          const sentences = tokenizer.tokenize(text);

          // Group sentences into sections (e.g., 3 sentences per section)
          const sectionSize = 3;
          const sections = [];

          for (let i = 0; i < sentences.length; i += sectionSize) {

               sections.push(
                    sentences.slice(i, i + sectionSize).join(' ')
               );
          }

          return sections;
     }

     search(query: string, topN = 3) {

          const queryTerms = this.getImportantTerms(query);

          const results = this.sections.map((section, index) => {

               const sectionTerms = this.getImportantTerms(section);

               const similarity = compareTwoStrings(queryTerms.join(' '), sectionTerms.join(' '));

               return { index, section, similarity };
          });

          results.sort((a, b) => b.similarity - a.similarity);

          return results.slice(0, topN);
     }

     getImportantTerms(text: string) {

          const tfidf = new TfIdf();

          tfidf.addDocument(text);

          return tfidf.listTerms(0)
               .sort((a, b) => b.tfidf - a.tfidf)
               .slice(0, 10)  // Get top 10 terms
               .map(item => item.term);
     }
}
