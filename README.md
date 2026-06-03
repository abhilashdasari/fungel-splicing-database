# Differential Splicing Explorer

Static GitHub Pages project for hosting public differential splicing results and running lightweight browser-side analysis with webR.

## Contents

- `index.html` - application shell
- `style.css` - responsive UI styling
- `app.js` - CSV loading, filtering, charts, downloads, and webR integration
- `data/splicing_event_distribution.csv` - comparison-level rMATS event counts
- `data/splicing_event_distribution_by_disease.csv` - disease-level summary
- `data/splicing_tool_distribution.csv` - tool-level summary
- `data/comparison_name_mapping.csv` - short comparison names used in the plots
- `data/gene_list_manifest.json` - manifest for workbook-derived gene downloads
- `data/gene_lists/` - one downloadable gene-list CSV per comparison
- `scripts/export_gene_lists.py` - regenerates `data/gene_lists/` from the 68-sheet workbook

## Run Locally

From this folder:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

The page must be served over HTTP because browsers restrict `fetch()` when opening local files directly.

## Deploy On GitHub Pages

1. Create a new GitHub repository, for example `splicing-webr-database`.
2. Upload this folder's contents to the repository root.
3. In GitHub, open `Settings -> Pages`.
4. Set source to `Deploy from a branch`.
5. Select the `main` branch and `/root`.
6. Save. GitHub will publish the site after a short build step.

## Updating Data

After rerunning the thesis analysis pipeline, replace the CSV files in `data/` with updated exports:

```bash
cp ../analysis_pipeline/19_splicing_event_analysis/01_splicing_event_distribution.csv data/splicing_event_distribution.csv
cp ../analysis_pipeline/19_splicing_event_analysis/01_splicing_event_distribution_by_disease.csv data/splicing_event_distribution_by_disease.csv
cp ../analysis_pipeline/19_splicing_event_analysis/01_splicing_tool_distribution.csv data/splicing_tool_distribution.csv
cp ../analysis_pipeline/19_splicing_event_analysis/comparison_name_mapping.csv data/comparison_name_mapping.csv
python3 scripts/export_gene_lists.py
```

Commit and push the changed CSV files to update the public database.

## Notes

- Heavy splicing detection should remain precomputed in the analysis pipeline.
- webR is used here for downstream summaries on filtered public tables.
- For very large datasets, split CSV files by disease or comparison, or host large archives on Zenodo/Figshare and link them from this app.
