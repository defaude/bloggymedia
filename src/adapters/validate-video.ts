import { $ } from 'zx';

// Packet payloads of copied streams must survive; timestamps may be rebased by the muxer.
export async function copiedStreamPackets(path: string, indices: number[]): Promise<string[][]> {
    const results: string[][] = [];
    for (const index of indices) {
        const { stdout } =
            await $`ffprobe -v error -select_streams ${index} -show_packets -show_data_hash sha256 -show_entries packet=stream_index,data_hash -of json ${path}`;
        const { packets } = JSON.parse(stdout) as { packets: { stream_index: number; data_hash: string }[] };
        results.push(
            packets.map(packet => {
                if (packet.stream_index !== index || !packet.data_hash) {
                    throw new Error('Invalid copied stream packet hash');
                }
                return packet.data_hash;
            })
        );
    }
    return results;
}
