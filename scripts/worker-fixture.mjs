import {build} from 'esbuild'
import {join} from 'node:path'

/** Compile the real Worker and keep each test's durable storage isolated. */
export async function buildWorkerOptions(directory, log) {
  const scriptPath=join(directory,'worker.mjs')
  await build({entryPoints:['worker/index.ts'],outfile:scriptPath,bundle:true,format:'esm',platform:'browser',target:'es2023'})
  return {
    modules:true, modulesRoot:directory, scriptPath, compatibilityDate:'2025-01-01',
    durableObjects:{GAME_ROOM:{className:'GameRoom',useSQLite:true},ROOM_REGISTRY:{className:'RoomRegistry',useSQLite:true}},
    durableObjectsPersist:join(directory,'storage'),
    ...(log ? {log} : {}),
  }
}
