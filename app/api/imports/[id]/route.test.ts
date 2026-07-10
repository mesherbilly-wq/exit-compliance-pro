import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/imports/[id]/route";
import * as repository from "@/lib/server/db/inbound-email-repository";

describe("DELETE /api/imports/[id]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.SUPABASE_STORAGE_BUCKET = "inbound-csv";
  });

  it("deletes an import", async () => {
    vi.spyOn(repository, "deleteServerImport").mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost/api/imports/import-1"), {
      params: Promise.resolve({ id: "import-1" }),
    });

    expect(response.status).toBe(200);
    expect(repository.deleteServerImport).toHaveBeenCalledWith(
      "import-1",
      "inbound-csv",
    );
  });
});
