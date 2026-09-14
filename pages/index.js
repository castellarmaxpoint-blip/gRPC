export default function Home() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination:
        "https://studio.apollographql.com/sandbox/explorer?endpoint=https://lab-04-graphql-lyart.vercel.app/api/graphql",
      permanent: false,
    },
  };
}