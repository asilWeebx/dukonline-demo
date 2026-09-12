# Vendored storefront dependencies

These pinned browser assets are stored locally so the catalog UI does not depend on third-party CDNs during normal page load.

- React 18.2.0 and React DOM 18.2.0 browser bundles: esm.sh distributions of the official npm packages. The local React DOM client bundle also re-exports `createPortal` from the React DOM implementation embedded in that same pinned bundle.
- HTM 3.1.1 browser bundle: esm.sh distribution of the official npm package.
- Leaflet 1.9.4: official `dist` assets from unpkg; loaded only when the delivery map is opened.
- Montserrat: Google Fonts files licensed under the SIL Open Font License in `fonts/OFL.txt`.

The live OpenStreetMap tile and Nominatim services remain network-backed because map imagery and reverse geocoding require current geographic data.
