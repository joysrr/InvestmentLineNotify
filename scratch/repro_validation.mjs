import { validateStrategyConfig } from '../src/modules/strategy/signalRules.mjs';
import { readFile } from 'fs/promises';

async function test() {
  try {
    const text = await readFile('./data/config/Strategy.json', 'utf-8');
    const json = JSON.parse(text);
    console.log('Parsed JSON version:', json.version);
    console.log('maintenance:', json.maintenance);
    validateStrategyConfig(json);
    console.log('Validation passed!');
  } catch (e) {
    console.error('Validation failed:');
    console.error(e);
  }
}

test();
