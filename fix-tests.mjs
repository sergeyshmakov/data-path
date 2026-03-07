import fs from 'fs';
import path from 'path';

function fixTests(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            fixTests(full);
        } else if (full.endsWith('.ts')) {
            let content = fs.readFileSync(full, 'utf8');
            // path<User>((p) => ...) => path((p: User) => ...)
            content = content.replace(/path<([^>]+)>\(\(([a-zA-Z0-9_]+)\) =>/g, 'path(($2: $1) =>');
            content = content.replace(/path<([^>]+)>\(\(([a-zA-Z0-9_]+)\) =>/g, 'path(($2: $1) =>');
            content = content.replace(/path<([^>]+)>\(\(([a-zA-Z0-9_]+)\) =>/g, 'path(($2: $1) =>');
            fs.writeFileSync(full, content);
        }
    }
}

fixTests('src/tests');
