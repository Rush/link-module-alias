#!/usr/bin/env node
// Author: Damian "Rush" Kaczmarek

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const moduleAliases = packageJson._moduleAliases;
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const execFile = promisify(child_process.execFile);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const symlink = promisify(fs.symlink);
const mkdir = promisify(fs.mkdir);

const chalk = require('chalk');

function addColor({moduleName, type, target}) {
  if(type === 'none') {
    moduleName = chalk.red(moduleName);
  } else if(type === 'symlink') {
    moduleName = chalk.cyan(moduleName);
  } else if(type === 'proxy') {
    moduleName = chalk.green(moduleName);
  }
  return `${moduleName} -> ${chalk.bold(target)}`;
}

async function exists(filename) {
  try {
    await stat(filename);
    return true;
  } catch(err) {
    return false;
  }
}

async function unlinkModule(moduleName) {
  let statKey;
  try {
    statKey = await stat(`node_modules/${key}`);
  } catch(err) {}
  
  if(statKey && statKey.isSymbolicLink()) {
    await unlink(`node_modules/${key}`);
  } else {
    await execFile('rm', ['-rf', `node_modules/${moduleName}`])
    await execFile('rm', ['-rf', `node_modules/.link-module-alias-${moduleName}`])
  }
  return moduleName;
}

function js(strings, ...interpolatedValues) {
  return strings.reduce((total, current, index) => {
    total += current;
    if (interpolatedValues.hasOwnProperty(index)) {
      total += JSON.stringify(interpolatedValues[index]);
    }
    return total;
  }, '');
}

async function linkModule(moduleName) {
  const moduleExists = await exists(`node_modules/${moduleName}`);
  const linkExists = await exists(`node_modules/.link-module-alias-${moduleName}`);
  const target = moduleAliases[moduleName];

  let type;
  if(moduleExists && !linkExists) {
    console.error(`Module ${moduleName} already exists and wasn't created by us, skipping`);
    type = 'none';
    return { moduleName, type, target };
  } else {
    await unlinkModule(moduleName);
  }

  if(target.match(/\.js$/)) {
    console.log(`Target ${target} is a direct link, creating proxy require`);
    await mkdir(`node_modules/${moduleName}`);
    await writeFile(`node_modules/${moduleName}/package.json`, js`
      {
        "name": ${moduleName},
        "main": ${path.join('../../', target)}
      }
    `);
    type = 'proxy';
  } else {
    const stat = fs.statSync(target);
    if(!stat.isDirectory) {
      console.log(`Target ${target} is not a directory, skipping ...`);
      type = 'none';
      return { moduleName, type, type };
    }
    // console.log(`Target ${target} is a directory, creating symlink`);
    await symlink(path.join('../', target), `node_modules/${moduleName}`);
    type = 'symlink';
  }
  await writeFile(`node_modules/.link-module-alias-${moduleName}`, '');
  return { moduleName, type, target };
}

async function linkModules() {
  const modules = await Promise.all(Object.keys(moduleAliases).map(async key => {
    return linkModule(key);
  }));
  console.log('Module aliases:', modules.map(addColor).join(', '));
}

async function unlinkModules() {
  const allModules = await readdir('node_modules');

  const modules = allModules.map(file => {
    const m = file.match(/^\.link-module-alias-(.*)/);
    return m && m[1];
  }).filter(v => !!v);

  const unlinkedModules = await Promise.all(modules.map(async mod => {
    await unlinkModule(mod);
    return mod;
  }));
  console.log('Modules unlinked:', unlinkedModules.join(' '));
}

if(process.argv[2] === 'unlink') {
  unlinkModules();
} else {
  linkModules();
}
