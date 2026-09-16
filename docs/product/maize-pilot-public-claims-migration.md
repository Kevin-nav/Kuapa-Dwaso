# Maize pilot public-claims correction

Date prepared: 12 September 2026

This correction keeps the two field visits as historical events while removing present-tense claims that Kuapa Dwaso already operates a warehouse network. It also makes the Extech relationship explicitly prospective. Editing the seed files does not change a live blog post; live publication is a separate, authorised editorial action.

## Claims corrected in the seeds

### Tarkwa farmer and trader visit

- Replaced the claim that farmers currently deposit at participating community warehouses with the implemented demand-led maize pilot: buyer requirement, farmer offer, quality check, collection, delivery and settlement.
- Replaced verified-warehouse-stock and dated-market-run claims with commercial maize requirements and transaction-specific fulfilment.
- Removed the suggestion that payment success follows dispatch automatically; acceptance, obligations and reconciled settlement are now distinct.
- Replaced “warehouse network reaches new communities” with the controlled pilot reaching participating communities.
- Replaced warehouse activity and registration implications with the evidence needed before any storage or warehouse decision.
- Updated the story excerpt and added a dated editorial note without removing the visit history or photographs.

### Extech Agricultural Services visit

- Added a dated note that the visit is not a signed order, endorsement or operating partnership.
- Described Extech’s possible role as prospective and transaction-specific.
- Replaced the claim that Kuapa Dwaso currently starts with participating warehouses with the no-warehouse commercial maize pilot.
- Replaced present-tense warehouse intake, receipt, verified-stock and scheduled-run claims with implemented pilot controls.
- Reframed storage and owned infrastructure as conditional on repeated demand, storage need, utilisation and sustainable economics.
- Updated the current workflow, measurement list, closing summary and excerpt while preserving the 7 August 2026 visit and accurate warehouse-tour captions.

## Scoped migration procedure

1. Run each dry-run against the intended Convex deployment:

   ```text
   npx convex run seedFirstBlog:seed '{"dryRun":true}'
   npx convex run seedSecondBlog:seed '{"dryRun":true}'
   ```

2. Record the returned `blogPostId` and `currentUpdatedAt`. Confirm the IDs are the two named stories and export their current content for editorial backup.
3. Review the dated corrections and obtain publication approval.
4. Run each mutation with its exact returned ID and timestamp. Example placeholders are intentionally not executable:

   ```text
   npx convex run seedFirstBlog:seed '{"expectedExistingId":"<FIRST_POST_ID>","expectedExistingUpdatedAt":<FIRST_UPDATED_AT>}'
   npx convex run seedSecondBlog:seed '{"expectedExistingId":"<SECOND_POST_ID>","expectedExistingUpdatedAt":<SECOND_UPDATED_AT>}'
   ```

5. If either story changed after the dry-run, the mutation fails closed. Repeat the dry-run and editorial comparison; do not overwrite the newer revision.
6. Verify both public URLs, the editorial update paragraphs, image captions, page metadata and sitemap timestamps after publication.

No live migration or publication was performed by KD-16.
