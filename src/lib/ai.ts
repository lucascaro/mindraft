import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function refineIdea(title: string, body: string) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are helping someone develop their ideas. Given the following idea, provide:
1. A refined, clearer version of the idea
2. 3-5 thought-provoking questions to explore it further
3. Suggested tags (2-4 single words)

Format your response in markdown with sections: ## Refined Idea, ## Questions to Explore, ## Suggested Tags

**Title:** ${title}
**Notes:** ${body || "(no additional notes)"}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type === "text") {
    return content.text;
  }
  throw new Error("Unexpected response format");
}
