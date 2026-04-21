package com.example;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;

public class GenerateExample {
  public static void main(String[] args) {
    // The client reads the GEMINI_API_KEY environment variable automatically.
    // Do NOT paste or commit your API key in source or chat. If you exposed it, rotate it.
    Client client = new Client();

    String model = System.getenv("GEMINI_MODEL");
    if (model == null || model.isEmpty()) {
      model = "gemini-3-flash-preview"; // sensible default from quickstart
    }

    System.out.println("Using model: " + model);

    GenerateContentResponse response =
        client.models.generateContent(model, "Explain how AI works in a few words", null);

    System.out.println(response.text());
    client.close();
  }
}
