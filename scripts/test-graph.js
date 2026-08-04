async function main() {
  const res = await fetch("http://localhost:3000/api/graph?q=귀주");
  const data = await res.json();
  console.log(`Nodes found: ${data.graph?.nodes.length}`);
  if (data.graph?.nodes) {
    for (const n of data.graph.nodes) {
      console.log(`Node: id=${n.id}, type=${n.type}, label="${n.label}"`);
    }
  }
}
main().catch(console.error);
