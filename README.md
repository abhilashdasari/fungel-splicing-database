# Differential Splicing Explorer

This repository presents a curated differential splicing resource for comparing alternative splicing patterns across disease and control conditions. The dataset is organized around RNA-seq comparisons and highlights genes and splice-event classes that change across infection, liver disease, lung disease, fibrotic disease, and cancer contexts.

## Biological Scope

The database contains 68 pairwise comparisons covering broad disease groups:

- Viral infections, including MERS, SARS, SARS-CoV-2/COVID-19 time courses, and viral variant comparisons.
- Hepatobiliary conditions, including NAFLD/NASH, liver cirrhosis, hepatocellular carcinoma stages, gall bladder cancer, and liver ploidy/aging comparisons.
- Acute bacterial and inflammatory lung conditions, including tuberculosis and ARDS/sepsis comparisons.
- Chronic fibrotic and respiratory disease contexts, including IPF, COPD, asthma, tobacco-smoke exposure, and treatment-related asthma contrasts.
- Lung cancer comparisons, including NSCLC and SCLC.

Across the comparison-level summary, the current dataset contains 47,545 rMATS splice-event calls and 298,375 summed unique-gene counts across comparisons.

## Alternative Splicing Events

The event summary tracks five major classes of alternative splicing:

- `SE`: skipped exon events, where an exon is included in one condition and skipped in another.
- `RI`: retained intron events, where intronic sequence remains in mature RNA.
- `MXE`: mutually exclusive exon events, where alternative exons are selected in a condition-specific manner.
- `A3SS`: alternative 3-prime splice-site usage.
- `A5SS`: alternative 5-prime splice-site usage.

For each comparison, the table reports total rMATS events and the count and percentage contributed by each event class. These values help identify whether a biological condition is dominated by exon skipping, intron retention, splice-site shifts, or mutually exclusive exon usage.

## Gene-Level Interpretation

The Gene List Downloads section contains comparison-specific gene sets derived from the workbook exports. Each row represents a gene assigned to a comparison and gene set, such as upregulated or downregulated splicing-associated genes.

Gene annotations are joined from the Ensembl BioMart export using gene name. The added fields support biological filtering and interpretation:

- `Gene type`: gene biotype, such as `protein_coding`, `lncRNA`, `miRNA`, `snRNA`, or pseudogene classes.
- `Gene description`: functional description and source annotation where available.
- `Strand`: genomic strand orientation.
- `Gene start (bp)` and `Gene end (bp)`: genomic coordinates.
- `Chromosome/scaffold name`: chromosome, mitochondrial genome, or scaffold location.

The gene type filter is useful for separating protein-coding candidates from non-coding RNA classes such as lncRNAs. This is important because differential splicing can affect both canonical protein-coding transcripts and regulatory RNA genes.

## Splicing Tools Represented

The tool-level summary reports gene counts from four differential splicing approaches:

- `rMATS`: event-centered detection of exon skipping, retained introns, mutually exclusive exons, and alternative splice-site usage.
- `DEXSeq`: exon-level differential usage analysis.
- `Leafcutter`: intron-cluster-based splice junction analysis.
- `Sleuth`: transcript-level differential abundance analysis from pseudoalignment-based quantification.

Using multiple tools provides complementary evidence because each method captures a different view of splicing or transcript usage. Genes supported across methods may be stronger candidates for downstream biological validation, while method-specific calls may reflect event type, quantification strategy, or sample structure.

## Biological Use Cases

This resource can be used to:

- Compare splicing burden across diseases or experimental contrasts.
- Identify which splice-event classes dominate a condition.
- Retrieve disease-specific candidate genes for follow-up analysis.
- Filter candidate genes by biotype, such as focusing on `protein_coding` genes or exploring `lncRNA` involvement.
- Compare tool-level support for genes implicated in differential splicing.
- Prioritize genes for pathway analysis, literature review, or experimental validation.

## Data Files

- `data/splicing_event_distribution.csv`: comparison-level rMATS event counts and event-class percentages.
- `data/splicing_tool_distribution.csv`: tool-level gene counts for DEXSeq, Sleuth, Leafcutter, and rMATS.
- `data/gene_lists/`: comparison-specific gene lists used in the Gene List Downloads table.
- `data/gene_list_manifest.json`: metadata describing the available gene-list comparisons.
- `data/mart_export.csv`: Ensembl BioMart gene annotations used to add gene type, description, strand, coordinates, and chromosome/scaffold.
- `data/comparison_name_mapping.csv`: display names used for comparisons.

## Interpretation Notes

- Counts are comparison-level summaries and should be interpreted in the context of sample type, disease group, and analysis method.
- Gene lists may include repeated genes across comparisons or gene sets; use comparison and gene-set filters before biological interpretation.
- Some gene names may not match the BioMart export exactly, so annotation fields can be blank for those rows.
- Differential splicing evidence should be followed by transcript-level inspection, effect-size review, pathway context, and biological validation where possible.
