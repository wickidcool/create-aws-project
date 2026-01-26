import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Auth0 SPA library which uses TextEncoder/TextDecoder
Object.assign(global, { TextEncoder, TextDecoder });
