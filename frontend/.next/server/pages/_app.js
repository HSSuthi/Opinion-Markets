/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./src/lib/api/client.ts":
/*!*******************************!*\
  !*** ./src/lib/api/client.ts ***!
  \*******************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   api: () => (/* binding */ api),\n/* harmony export */   getApiClient: () => (/* binding */ getApiClient),\n/* harmony export */   initializeApiClient: () => (/* binding */ initializeApiClient)\n/* harmony export */ });\n/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! axios */ \"axios\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([axios__WEBPACK_IMPORTED_MODULE_0__]);\naxios__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\nconst API_URL = \"http://localhost:3001\" || 0;\nlet apiClient;\nfunction initializeApiClient() {\n    apiClient = axios__WEBPACK_IMPORTED_MODULE_0__[\"default\"].create({\n        baseURL: API_URL,\n        timeout: 10000,\n        headers: {\n            \"Content-Type\": \"application/json\"\n        }\n    });\n    // Response interceptor for error handling\n    apiClient.interceptors.response.use((response)=>response, (error)=>{\n        if (error.response?.status === 401) {\n            // Handle unauthorized\n            window.location.href = \"/\";\n        }\n        return Promise.reject(error);\n    });\n    return apiClient;\n}\nfunction getApiClient() {\n    if (!apiClient) {\n        initializeApiClient();\n    }\n    return apiClient;\n}\n// API Methods\nconst api = {\n    markets: {\n        list: async (params)=>{\n            const { data } = await getApiClient().get(\"/markets\", {\n                params\n            });\n            return data;\n        },\n        get: async (id)=>{\n            const { data } = await getApiClient().get(`/markets/${id}`);\n            return data;\n        },\n        create: async (payload)=>{\n            const { data } = await getApiClient().post(\"/markets\", payload);\n            return data;\n        }\n    },\n    opinions: {\n        list: async (marketId)=>{\n            const { data } = await getApiClient().get(`/markets/${marketId}/opinions`);\n            return data;\n        },\n        create: async (marketId, payload)=>{\n            const { data } = await getApiClient().post(`/markets/${marketId}/opinions`, payload);\n            return data;\n        }\n    },\n    user: {\n        portfolio: async (wallet)=>{\n            const { data } = await getApiClient().get(`/user/${wallet}`);\n            return data;\n        },\n        positions: async (wallet)=>{\n            const { data } = await getApiClient().get(`/user/${wallet}/positions`);\n            return data;\n        }\n    },\n    sentiment: {\n        history: async ()=>{\n            const { data } = await getApiClient().get(\"/sentiment/history\");\n            return data;\n        },\n        topicSearch: async (query)=>{\n            const { data } = await getApiClient().get(\"/sentiment/topic\", {\n                params: {\n                    q: query\n                }\n            });\n            return data;\n        }\n    }\n};\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvbGliL2FwaS9jbGllbnQudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUF5RDtBQUV6RCxNQUFNQyxVQUFVQyx1QkFBK0IsSUFBSTtBQUVuRCxJQUFJRztBQUVHLFNBQVNDO0lBQ2RELFlBQVlMLG9EQUFZLENBQUM7UUFDdkJRLFNBQVNQO1FBQ1RRLFNBQVM7UUFDVEMsU0FBUztZQUNQLGdCQUFnQjtRQUNsQjtJQUNGO0lBRUEsMENBQTBDO0lBQzFDTCxVQUFVTSxZQUFZLENBQUNDLFFBQVEsQ0FBQ0MsR0FBRyxDQUNqQyxDQUFDRCxXQUFhQSxVQUNkLENBQUNFO1FBQ0MsSUFBSUEsTUFBTUYsUUFBUSxFQUFFRyxXQUFXLEtBQUs7WUFDbEMsc0JBQXNCO1lBQ3RCQyxPQUFPQyxRQUFRLENBQUNDLElBQUksR0FBRztRQUN6QjtRQUNBLE9BQU9DLFFBQVFDLE1BQU0sQ0FBQ047SUFDeEI7SUFHRixPQUFPVDtBQUNUO0FBRU8sU0FBU2dCO0lBQ2QsSUFBSSxDQUFDaEIsV0FBVztRQUNkQztJQUNGO0lBQ0EsT0FBT0Q7QUFDVDtBQUVBLGNBQWM7QUFDUCxNQUFNaUIsTUFBTTtJQUNqQkMsU0FBUztRQUNQQyxNQUFNLE9BQU9DO1lBTVgsTUFBTSxFQUFFQyxJQUFJLEVBQUUsR0FBRyxNQUFNTCxlQUFlTSxHQUFHLENBQUMsWUFBWTtnQkFBRUY7WUFBTztZQUMvRCxPQUFPQztRQUNUO1FBRUFDLEtBQUssT0FBT0M7WUFDVixNQUFNLEVBQUVGLElBQUksRUFBRSxHQUFHLE1BQU1MLGVBQWVNLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRUMsR0FBRyxDQUFDO1lBQzFELE9BQU9GO1FBQ1Q7UUFFQW5CLFFBQVEsT0FBT3NCO1lBTWIsTUFBTSxFQUFFSCxJQUFJLEVBQUUsR0FBRyxNQUFNTCxlQUFlUyxJQUFJLENBQUMsWUFBWUQ7WUFDdkQsT0FBT0g7UUFDVDtJQUNGO0lBRUFLLFVBQVU7UUFDUlAsTUFBTSxPQUFPUTtZQUNYLE1BQU0sRUFBRU4sSUFBSSxFQUFFLEdBQUcsTUFBTUwsZUFBZU0sR0FBRyxDQUN2QyxDQUFDLFNBQVMsRUFBRUssU0FBUyxTQUFTLENBQUM7WUFFakMsT0FBT047UUFDVDtRQUVBbkIsUUFBUSxPQUNOeUIsVUFDQUg7WUFPQSxNQUFNLEVBQUVILElBQUksRUFBRSxHQUFHLE1BQU1MLGVBQWVTLElBQUksQ0FDeEMsQ0FBQyxTQUFTLEVBQUVFLFNBQVMsU0FBUyxDQUFDLEVBQy9CSDtZQUVGLE9BQU9IO1FBQ1Q7SUFDRjtJQUVBTyxNQUFNO1FBQ0pDLFdBQVcsT0FBT0M7WUFDaEIsTUFBTSxFQUFFVCxJQUFJLEVBQUUsR0FBRyxNQUFNTCxlQUFlTSxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUVRLE9BQU8sQ0FBQztZQUMzRCxPQUFPVDtRQUNUO1FBRUFVLFdBQVcsT0FBT0Q7WUFDaEIsTUFBTSxFQUFFVCxJQUFJLEVBQUUsR0FBRyxNQUFNTCxlQUFlTSxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUVRLE9BQU8sVUFBVSxDQUFDO1lBQ3JFLE9BQU9UO1FBQ1Q7SUFDRjtJQUVBVyxXQUFXO1FBQ1RDLFNBQVM7WUFDUCxNQUFNLEVBQUVaLElBQUksRUFBRSxHQUFHLE1BQU1MLGVBQWVNLEdBQUcsQ0FBQztZQUMxQyxPQUFPRDtRQUNUO1FBRUFhLGFBQWEsT0FBT0M7WUFDbEIsTUFBTSxFQUFFZCxJQUFJLEVBQUUsR0FBRyxNQUFNTCxlQUFlTSxHQUFHLENBQUMsb0JBQW9CO2dCQUM1REYsUUFBUTtvQkFBRWdCLEdBQUdEO2dCQUFNO1lBQ3JCO1lBQ0EsT0FBT2Q7UUFDVDtJQUNGO0FBQ0YsRUFBRSIsInNvdXJjZXMiOlsid2VicGFjazovL29waW5pb24tbWFya2V0cy1mcm9udGVuZC8uL3NyYy9saWIvYXBpL2NsaWVudC50cz8xNTliIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBheGlvcywgeyBBeGlvc0luc3RhbmNlLCBBeGlvc0Vycm9yIH0gZnJvbSAnYXhpb3MnO1xuXG5jb25zdCBBUElfVVJMID0gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAxJztcblxubGV0IGFwaUNsaWVudDogQXhpb3NJbnN0YW5jZTtcblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVBcGlDbGllbnQoKSB7XG4gIGFwaUNsaWVudCA9IGF4aW9zLmNyZWF0ZSh7XG4gICAgYmFzZVVSTDogQVBJX1VSTCxcbiAgICB0aW1lb3V0OiAxMDAwMCxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFJlc3BvbnNlIGludGVyY2VwdG9yIGZvciBlcnJvciBoYW5kbGluZ1xuICBhcGlDbGllbnQuaW50ZXJjZXB0b3JzLnJlc3BvbnNlLnVzZShcbiAgICAocmVzcG9uc2UpID0+IHJlc3BvbnNlLFxuICAgIChlcnJvcjogQXhpb3NFcnJvcikgPT4ge1xuICAgICAgaWYgKGVycm9yLnJlc3BvbnNlPy5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgICAvLyBIYW5kbGUgdW5hdXRob3JpemVkXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gJy8nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICB9XG4gICk7XG5cbiAgcmV0dXJuIGFwaUNsaWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFwaUNsaWVudCgpIHtcbiAgaWYgKCFhcGlDbGllbnQpIHtcbiAgICBpbml0aWFsaXplQXBpQ2xpZW50KCk7XG4gIH1cbiAgcmV0dXJuIGFwaUNsaWVudDtcbn1cblxuLy8gQVBJIE1ldGhvZHNcbmV4cG9ydCBjb25zdCBhcGkgPSB7XG4gIG1hcmtldHM6IHtcbiAgICBsaXN0OiBhc3luYyAocGFyYW1zPzoge1xuICAgICAgbGltaXQ/OiBudW1iZXI7XG4gICAgICBvZmZzZXQ/OiBudW1iZXI7XG4gICAgICBzdGF0ZT86IHN0cmluZztcbiAgICAgIHNvcnRCeT86IHN0cmluZztcbiAgICB9KSA9PiB7XG4gICAgICBjb25zdCB7IGRhdGEgfSA9IGF3YWl0IGdldEFwaUNsaWVudCgpLmdldCgnL21hcmtldHMnLCB7IHBhcmFtcyB9KTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgICBnZXQ6IGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB7IGRhdGEgfSA9IGF3YWl0IGdldEFwaUNsaWVudCgpLmdldChgL21hcmtldHMvJHtpZH1gKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgICBjcmVhdGU6IGFzeW5jIChwYXlsb2FkOiB7XG4gICAgICBzdGF0ZW1lbnQ6IHN0cmluZztcbiAgICAgIGR1cmF0aW9uOiBudW1iZXI7XG4gICAgICBzaWduYXR1cmU6IHN0cmluZztcbiAgICAgIHdhbGxldDogc3RyaW5nO1xuICAgIH0pID0+IHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgZ2V0QXBpQ2xpZW50KCkucG9zdCgnL21hcmtldHMnLCBwYXlsb2FkKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG4gIH0sXG5cbiAgb3BpbmlvbnM6IHtcbiAgICBsaXN0OiBhc3luYyAobWFya2V0SWQ6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgeyBkYXRhIH0gPSBhd2FpdCBnZXRBcGlDbGllbnQoKS5nZXQoXG4gICAgICAgIGAvbWFya2V0cy8ke21hcmtldElkfS9vcGluaW9uc2BcbiAgICAgICk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuXG4gICAgY3JlYXRlOiBhc3luYyAoXG4gICAgICBtYXJrZXRJZDogc3RyaW5nLFxuICAgICAgcGF5bG9hZDoge1xuICAgICAgICBhbW91bnQ6IG51bWJlcjtcbiAgICAgICAgb3Bpbmlvbl90ZXh0OiBzdHJpbmc7XG4gICAgICAgIHNpZ25hdHVyZTogc3RyaW5nO1xuICAgICAgICB3YWxsZXQ6IHN0cmluZztcbiAgICAgIH1cbiAgICApID0+IHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgZ2V0QXBpQ2xpZW50KCkucG9zdChcbiAgICAgICAgYC9tYXJrZXRzLyR7bWFya2V0SWR9L29waW5pb25zYCxcbiAgICAgICAgcGF5bG9hZFxuICAgICAgKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG4gIH0sXG5cbiAgdXNlcjoge1xuICAgIHBvcnRmb2xpbzogYXN5bmMgKHdhbGxldDogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCB7IGRhdGEgfSA9IGF3YWl0IGdldEFwaUNsaWVudCgpLmdldChgL3VzZXIvJHt3YWxsZXR9YCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuXG4gICAgcG9zaXRpb25zOiBhc3luYyAod2FsbGV0OiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgZ2V0QXBpQ2xpZW50KCkuZ2V0KGAvdXNlci8ke3dhbGxldH0vcG9zaXRpb25zYCk7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9LFxuICB9LFxuXG4gIHNlbnRpbWVudDoge1xuICAgIGhpc3Rvcnk6IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgZ2V0QXBpQ2xpZW50KCkuZ2V0KCcvc2VudGltZW50L2hpc3RvcnknKTtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0sXG5cbiAgICB0b3BpY1NlYXJjaDogYXN5bmMgKHF1ZXJ5OiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgZ2V0QXBpQ2xpZW50KCkuZ2V0KCcvc2VudGltZW50L3RvcGljJywge1xuICAgICAgICBwYXJhbXM6IHsgcTogcXVlcnkgfSxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSxcbiAgfSxcbn07XG4iXSwibmFtZXMiOlsiYXhpb3MiLCJBUElfVVJMIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX0FQSV9VUkwiLCJhcGlDbGllbnQiLCJpbml0aWFsaXplQXBpQ2xpZW50IiwiY3JlYXRlIiwiYmFzZVVSTCIsInRpbWVvdXQiLCJoZWFkZXJzIiwiaW50ZXJjZXB0b3JzIiwicmVzcG9uc2UiLCJ1c2UiLCJlcnJvciIsInN0YXR1cyIsIndpbmRvdyIsImxvY2F0aW9uIiwiaHJlZiIsIlByb21pc2UiLCJyZWplY3QiLCJnZXRBcGlDbGllbnQiLCJhcGkiLCJtYXJrZXRzIiwibGlzdCIsInBhcmFtcyIsImRhdGEiLCJnZXQiLCJpZCIsInBheWxvYWQiLCJwb3N0Iiwib3BpbmlvbnMiLCJtYXJrZXRJZCIsInVzZXIiLCJwb3J0Zm9saW8iLCJ3YWxsZXQiLCJwb3NpdGlvbnMiLCJzZW50aW1lbnQiLCJoaXN0b3J5IiwidG9waWNTZWFyY2giLCJxdWVyeSIsInEiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/lib/api/client.ts\n");

/***/ }),

/***/ "./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ App)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _solana_wallet_adapter_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @solana/wallet-adapter-react */ \"@solana/wallet-adapter-react\");\n/* harmony import */ var _solana_wallet_adapter_base__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @solana/wallet-adapter-base */ \"@solana/wallet-adapter-base\");\n/* harmony import */ var _solana_wallet_adapter_wallets__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @solana/wallet-adapter-wallets */ \"@solana/wallet-adapter-wallets\");\n/* harmony import */ var _solana_web3_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @solana/web3.js */ \"@solana/web3.js\");\n/* harmony import */ var _solana_web3_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_solana_web3_js__WEBPACK_IMPORTED_MODULE_5__);\n/* harmony import */ var _solana_wallet_adapter_react_ui__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @solana/wallet-adapter-react-ui */ \"@solana/wallet-adapter-react-ui\");\n/* harmony import */ var _lib_api_client__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @/lib/api/client */ \"./src/lib/api/client.ts\");\n/* harmony import */ var _solana_wallet_adapter_react_ui_styles_css__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @solana/wallet-adapter-react-ui/styles.css */ \"./node_modules/@solana/wallet-adapter-react-ui/styles.css\");\n/* harmony import */ var _solana_wallet_adapter_react_ui_styles_css__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_solana_wallet_adapter_react_ui_styles_css__WEBPACK_IMPORTED_MODULE_8__);\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @/styles/globals.css */ \"./styles/globals.css\");\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(_styles_globals_css__WEBPACK_IMPORTED_MODULE_9__);\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_solana_wallet_adapter_react__WEBPACK_IMPORTED_MODULE_2__, _solana_wallet_adapter_base__WEBPACK_IMPORTED_MODULE_3__, _solana_wallet_adapter_wallets__WEBPACK_IMPORTED_MODULE_4__, _solana_wallet_adapter_react_ui__WEBPACK_IMPORTED_MODULE_6__, _lib_api_client__WEBPACK_IMPORTED_MODULE_7__]);\n([_solana_wallet_adapter_react__WEBPACK_IMPORTED_MODULE_2__, _solana_wallet_adapter_base__WEBPACK_IMPORTED_MODULE_3__, _solana_wallet_adapter_wallets__WEBPACK_IMPORTED_MODULE_4__, _solana_wallet_adapter_react_ui__WEBPACK_IMPORTED_MODULE_6__, _lib_api_client__WEBPACK_IMPORTED_MODULE_7__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n\n\n\n\n\n\n\n\n\n\n// Initialize API client on app load\n(0,_lib_api_client__WEBPACK_IMPORTED_MODULE_7__.initializeApiClient)();\nfunction App({ Component, pageProps }) {\n    const network = _solana_wallet_adapter_base__WEBPACK_IMPORTED_MODULE_3__.WalletAdapterNetwork.Devnet;\n    const endpoint = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(()=>(0,_solana_web3_js__WEBPACK_IMPORTED_MODULE_5__.clusterApiUrl)(network), []);\n    const wallets = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(()=>[\n            new _solana_wallet_adapter_wallets__WEBPACK_IMPORTED_MODULE_4__.PhantomWalletAdapter(),\n            new _solana_wallet_adapter_wallets__WEBPACK_IMPORTED_MODULE_4__.SolflareWalletAdapter()\n        ], []);\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_solana_wallet_adapter_react__WEBPACK_IMPORTED_MODULE_2__.ConnectionProvider, {\n        endpoint: endpoint,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_solana_wallet_adapter_react__WEBPACK_IMPORTED_MODULE_2__.WalletProvider, {\n            wallets: wallets,\n            autoConnect: true,\n            children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_solana_wallet_adapter_react_ui__WEBPACK_IMPORTED_MODULE_6__.WalletModalProvider, {\n                children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                    ...pageProps\n                }, void 0, false, {\n                    fileName: \"/Users/hsuthi/Desktop/Opinion-Markets-main/frontend/src/pages/_app.tsx\",\n                    lineNumber: 31,\n                    columnNumber: 11\n                }, this)\n            }, void 0, false, {\n                fileName: \"/Users/hsuthi/Desktop/Opinion-Markets-main/frontend/src/pages/_app.tsx\",\n                lineNumber: 30,\n                columnNumber: 9\n            }, this)\n        }, void 0, false, {\n            fileName: \"/Users/hsuthi/Desktop/Opinion-Markets-main/frontend/src/pages/_app.tsx\",\n            lineNumber: 29,\n            columnNumber: 7\n        }, this)\n    }, void 0, false, {\n        fileName: \"/Users/hsuthi/Desktop/Opinion-Markets-main/frontend/src/pages/_app.tsx\",\n        lineNumber: 28,\n        columnNumber: 5\n    }, this);\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3giLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBdUM7QUFFMkM7QUFDZjtBQUkzQjtBQUNRO0FBQ3NCO0FBQ2Y7QUFDSDtBQUN0QjtBQUU5QixvQ0FBb0M7QUFDcENTLG9FQUFtQkE7QUFFSixTQUFTQyxJQUFJLEVBQUVDLFNBQVMsRUFBRUMsU0FBUyxFQUFZO0lBQzVELE1BQU1DLFVBQVVULDZFQUFvQkEsQ0FBQ1UsTUFBTTtJQUMzQyxNQUFNQyxXQUFXZCw4Q0FBT0EsQ0FBQyxJQUFNTSw4REFBYUEsQ0FBQ00sVUFBVSxFQUFFO0lBRXpELE1BQU1HLFVBQVVmLDhDQUFPQSxDQUNyQixJQUFNO1lBQUMsSUFBSUksZ0ZBQW9CQTtZQUFJLElBQUlDLGlGQUFxQkE7U0FBRyxFQUMvRCxFQUFFO0lBR0oscUJBQ0UsOERBQUNKLDRFQUFrQkE7UUFBQ2EsVUFBVUE7a0JBQzVCLDRFQUFDWix3RUFBY0E7WUFBQ2EsU0FBU0E7WUFBU0MsV0FBVztzQkFDM0MsNEVBQUNULGdGQUFtQkE7MEJBQ2xCLDRFQUFDRztvQkFBVyxHQUFHQyxTQUFTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLbEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9vcGluaW9uLW1hcmtldHMtZnJvbnRlbmQvLi9zcmMvcGFnZXMvX2FwcC50c3g/ZjlkNiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB0eXBlIHsgQXBwUHJvcHMgfSBmcm9tICduZXh0L2FwcCc7XG5pbXBvcnQgeyBDb25uZWN0aW9uUHJvdmlkZXIsIFdhbGxldFByb3ZpZGVyIH0gZnJvbSAnQHNvbGFuYS93YWxsZXQtYWRhcHRlci1yZWFjdCc7XG5pbXBvcnQgeyBXYWxsZXRBZGFwdGVyTmV0d29yayB9IGZyb20gJ0Bzb2xhbmEvd2FsbGV0LWFkYXB0ZXItYmFzZSc7XG5pbXBvcnQge1xuICBQaGFudG9tV2FsbGV0QWRhcHRlcixcbiAgU29sZmxhcmVXYWxsZXRBZGFwdGVyLFxufSBmcm9tICdAc29sYW5hL3dhbGxldC1hZGFwdGVyLXdhbGxldHMnO1xuaW1wb3J0IHsgY2x1c3RlckFwaVVybCB9IGZyb20gJ0Bzb2xhbmEvd2ViMy5qcyc7XG5pbXBvcnQgeyBXYWxsZXRNb2RhbFByb3ZpZGVyIH0gZnJvbSAnQHNvbGFuYS93YWxsZXQtYWRhcHRlci1yZWFjdC11aSc7XG5pbXBvcnQgeyBpbml0aWFsaXplQXBpQ2xpZW50IH0gZnJvbSAnQC9saWIvYXBpL2NsaWVudCc7XG5pbXBvcnQgJ0Bzb2xhbmEvd2FsbGV0LWFkYXB0ZXItcmVhY3QtdWkvc3R5bGVzLmNzcyc7XG5pbXBvcnQgJ0Avc3R5bGVzL2dsb2JhbHMuY3NzJztcblxuLy8gSW5pdGlhbGl6ZSBBUEkgY2xpZW50IG9uIGFwcCBsb2FkXG5pbml0aWFsaXplQXBpQ2xpZW50KCk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFwcCh7IENvbXBvbmVudCwgcGFnZVByb3BzIH06IEFwcFByb3BzKSB7XG4gIGNvbnN0IG5ldHdvcmsgPSBXYWxsZXRBZGFwdGVyTmV0d29yay5EZXZuZXQ7XG4gIGNvbnN0IGVuZHBvaW50ID0gdXNlTWVtbygoKSA9PiBjbHVzdGVyQXBpVXJsKG5ldHdvcmspLCBbXSk7XG5cbiAgY29uc3Qgd2FsbGV0cyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gW25ldyBQaGFudG9tV2FsbGV0QWRhcHRlcigpLCBuZXcgU29sZmxhcmVXYWxsZXRBZGFwdGVyKCldLFxuICAgIFtdXG4gICk7XG5cbiAgcmV0dXJuIChcbiAgICA8Q29ubmVjdGlvblByb3ZpZGVyIGVuZHBvaW50PXtlbmRwb2ludH0+XG4gICAgICA8V2FsbGV0UHJvdmlkZXIgd2FsbGV0cz17d2FsbGV0c30gYXV0b0Nvbm5lY3Q+XG4gICAgICAgIDxXYWxsZXRNb2RhbFByb3ZpZGVyPlxuICAgICAgICAgIDxDb21wb25lbnQgey4uLnBhZ2VQcm9wc30gLz5cbiAgICAgICAgPC9XYWxsZXRNb2RhbFByb3ZpZGVyPlxuICAgICAgPC9XYWxsZXRQcm92aWRlcj5cbiAgICA8L0Nvbm5lY3Rpb25Qcm92aWRlcj5cbiAgKTtcbn1cbiJdLCJuYW1lcyI6WyJSZWFjdCIsInVzZU1lbW8iLCJDb25uZWN0aW9uUHJvdmlkZXIiLCJXYWxsZXRQcm92aWRlciIsIldhbGxldEFkYXB0ZXJOZXR3b3JrIiwiUGhhbnRvbVdhbGxldEFkYXB0ZXIiLCJTb2xmbGFyZVdhbGxldEFkYXB0ZXIiLCJjbHVzdGVyQXBpVXJsIiwiV2FsbGV0TW9kYWxQcm92aWRlciIsImluaXRpYWxpemVBcGlDbGllbnQiLCJBcHAiLCJDb21wb25lbnQiLCJwYWdlUHJvcHMiLCJuZXR3b3JrIiwiRGV2bmV0IiwiZW5kcG9pbnQiLCJ3YWxsZXRzIiwiYXV0b0Nvbm5lY3QiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n");

/***/ }),

/***/ "./styles/globals.css":
/*!****************************!*\
  !*** ./styles/globals.css ***!
  \****************************/
/***/ (() => {



/***/ }),

/***/ "@solana/web3.js":
/*!**********************************!*\
  !*** external "@solana/web3.js" ***!
  \**********************************/
/***/ ((module) => {

"use strict";
module.exports = require("@solana/web3.js");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("react");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "@solana/wallet-adapter-base":
/*!**********************************************!*\
  !*** external "@solana/wallet-adapter-base" ***!
  \**********************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@solana/wallet-adapter-base");;

/***/ }),

/***/ "@solana/wallet-adapter-react":
/*!***********************************************!*\
  !*** external "@solana/wallet-adapter-react" ***!
  \***********************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@solana/wallet-adapter-react");;

/***/ }),

/***/ "@solana/wallet-adapter-react-ui":
/*!**************************************************!*\
  !*** external "@solana/wallet-adapter-react-ui" ***!
  \**************************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@solana/wallet-adapter-react-ui");;

/***/ }),

/***/ "@solana/wallet-adapter-wallets":
/*!*************************************************!*\
  !*** external "@solana/wallet-adapter-wallets" ***!
  \*************************************************/
/***/ ((module) => {

"use strict";
module.exports = import("@solana/wallet-adapter-wallets");;

/***/ }),

/***/ "axios":
/*!************************!*\
  !*** external "axios" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = import("axios");;

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/@solana"], () => (__webpack_exec__("./src/pages/_app.tsx")));
module.exports = __webpack_exports__;

})();