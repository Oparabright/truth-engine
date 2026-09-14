import { NextRequest, NextResponse } from "next/server";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

function getDomain(url: string) {
  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const question = String(
      body?.question || ""
    ).trim();

    if (!question) {
      return NextResponse.json(
        {
          error: "Question is required.",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Tavily API key is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,

          // Keep the search tightly grounded
          // in the user's actual question.
          query: question,

          search_depth: "advanced",

          // Get more candidates first.
          max_results: 8,

          include_answer: false,
          include_raw_content: false,
        }),
      }
    );

    if (!response.ok) {
      const text =
        await response.text();

      return NextResponse.json(
        {
          error:
            "Evidence search failed.",
          details: text,
        },
        {
          status: response.status,
        }
      );
    }

    const data =
      await response.json();

    const candidates: TavilyResult[] =
      Array.isArray(data?.results)
        ? data.results
        : [];

    /*
      Sort using Tavily's relevance score.

      Higher score = more relevant to
      the actual question.
    */
    const sorted = [...candidates].sort(
      (a, b) =>
        Number(b?.score || 0) -
        Number(a?.score || 0)
    );

    /*
      Prefer source diversity.

      We don't want all three pieces
      of evidence coming from the
      exact same website.
    */
    const selected: {
      title: string;
      url: string;
      snippet: string;
      domain: string;
      score: number;
    }[] = [];

    const usedDomains =
      new Set<string>();

    for (const item of sorted) {
      if (
        !item?.url ||
        typeof item.url !== "string"
      ) {
        continue;
      }

      const domain =
        getDomain(item.url);

      if (!domain) {
        continue;
      }

      if (usedDomains.has(domain)) {
        continue;
      }

      selected.push({
        title: String(
          item.title || ""
        ),

        url: String(item.url),

        snippet: String(
          item.content || ""
        ),

        domain,

        score: Number(
          item.score || 0
        ),
      });

      usedDomains.add(domain);

      if (selected.length === 3) {
        break;
      }
    }

    return NextResponse.json({
      question,
      results: selected,
    });
  } catch (error) {
    console.error(
      "Evidence search route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected evidence search error.",
      },
      {
        status: 500,
      }
    );
  }
}