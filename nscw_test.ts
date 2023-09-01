import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";

import {
  Account,
  ClaimsData,
  createAccount,
  createOperator,
  decode,
  Operator,
  parseCreds,
  User,
} from "https://raw.githubusercontent.com/nats-io/jwt.js/main/src/mod.ts";
import { join } from "https://deno.land/std@0.179.0/path/mod.ts";
async function run(
  args: string[],
  data: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const env: Record<string, string> = {};
  env.XDG_CONFIG_HOME = data;
  env.XDG_DATA_HOME = data;
  const cmd = new Deno.Command("nscw", {
    args,
    env,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  return cmd.output().then((r) => {
    return {
      code: r.code,
      stdout: r.stdout.length ? new TextDecoder().decode(r.stdout) : "",
      stderr: r.stderr.length ? new TextDecoder().decode(r.stderr) : "",
    };
  });
}

Deno.test("operator", async (t) => {
  const dir = await Deno.makeTempDir();

  await t.step("list - empty", async () => {
    const { code, stdout } = await run(["operator", "list"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stdout, "no operators defined in store dir");
  });

  await t.step("add", async () => {
    const { code, stderr } = await run(["operator", "add", "O"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored operator key "O');
  });

  await t.step("add again", async () => {
    const { code, stderr } = await run(["operator", "add", "OO"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored operator key "O');
  });

  await t.step("get", async () => {
    const { code, stdout } = await run(
      ["operator", "get", "--json"],
      dir,
    );
    assertEquals(code, 0);
    const o = JSON.parse(stdout);
    assertEquals(o.name, "OO");
    assertEquals(o.nats.type, "operator");
  });

  await t.step("save to file", async () => {
    const fp = join(dir, "get-out.jwt");
    const { code } = await run(
      ["operator", "get", "--out", fp],
      dir,
    );
    assertEquals(code, 0);
    const raw = Deno.readTextFileSync(fp);
    assertStringIncludes(raw, "-----BEGIN NATS OPERATOR JWT-----");
    assertStringIncludes(raw, "------END NATS OPERATOR JWT------");
    const lines = raw.split("\n");
    const oc = decode<ClaimsData<Operator>>(lines[1]);
    assertEquals(oc.name, "OO");
    assertEquals(oc.nats.type, "operator");
  });

  await t.step("select", async () => {
    let r = await run(["operator", "select", "O"], dir);
    assertEquals(r.code, 0);
    r = await run(["operator", "get", "--json"], dir);

    const o = JSON.parse(r.stdout);
    assertEquals(o.name, "O");
    assertEquals(o.nats.type, "operator");
  });

  await t.step("describe", async () => {
    let r = await run(["operator", "describe"], dir);
    const lines = r.stdout.split("\n");
    const name = lines.filter((l) => {
      return l.includes("Name");
    });
    assertEquals(name.length, 1);
    name[0] = name[0].replace(/\s+/g, " ");
    assertEquals(name[0], "| Name | O |");
  });

  await t.step("edit", async () => {
    let r = await run(["operator", "edit", "--expiry", "1y"], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] changed jwt expiry to ${new Date().getUTCFullYear() + 1}`,
    );

    r = await run([
      "operator",
      "edit",
      "--account-jwt-server-url",
      "https://someserver:1234",
    ], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] set account jwt server url to "https://someserver:1234"`,
    );

    r = await run(["operator", "edit", "--rm-account-jwt-server-url"], dir);
    assertStringIncludes(r.stderr, "[ OK ] removed account server url");

    let k = createOperator();
    r = await run(["operator", "edit", "--sk", k.getPublicKey()], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] added signing key "${k.getPublicKey()}"`,
    );

    r = await run(["operator", "edit", "--rm-sk", k.getPublicKey()], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] removed signing key "${k.getPublicKey()}"`,
    );

    k = createAccount();
    r = await run(
      ["operator", "edit", "--system-account", k.getPublicKey()],
      dir,
    );
    assertStringIncludes(
      r.stderr,
      `[ OK ] set system account "${k.getPublicKey()}"`,
    );

    r = await run([
      "operator",
      "edit",
      "--service-url",
      "nats://localhost:4222",
    ], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] added service url "nats://localhost:4222"`,
    );
  });
});

Deno.test("accounts", async (t) => {
  const dir = await Deno.makeTempDir();
  await run(["operator", "add", "O"], dir);

  await t.step("list - empty", async () => {
    const { code, stderr } = await run(["accounts", "list"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, "No entries defined");
  });

  await t.step("add", async () => {
    const { code, stderr } = await run(["accounts", "add", "A"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored account key "A');
  });

  await t.step("add again", async () => {
    const { code, stderr } = await run(["accounts", "add", "AA"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored account key "A');
  });

  await t.step("get", async () => {
    const { code, stdout } = await run(
      ["accounts", "get", "--json"],
      dir,
    );
    assertEquals(code, 0);
    const o = JSON.parse(stdout);
    assertEquals(o.name, "AA");
    assertEquals(o.nats.type, "account");
  });

  await t.step("save to file", async () => {
    const fp = join(dir, "get-out.jwt");
    const { code } = await run(
      ["accounts", "get", "--out", fp],
      dir,
    );
    assertEquals(code, 0);
    const raw = Deno.readTextFileSync(fp);
    assertStringIncludes(raw, "-----BEGIN NATS ACCOUNT JWT-----");
    assertStringIncludes(raw, "------END NATS ACCOUNT JWT------");
    const lines = raw.split("\n");
    const oc = decode<ClaimsData<Account>>(lines[1]);
    assertEquals(oc.name, "AA");
    assertEquals(oc.nats.type, "account");
  });

  await t.step("select", async () => {
    let r = await run(["accounts", "select", "A"], dir);
    assertEquals(r.code, 0);
    r = await run(["accounts", "get", "--json"], dir);

    const o = JSON.parse(r.stdout);
    assertEquals(o.name, "A");
    assertEquals(o.nats.type, "account");
  });

  await t.step("describe", async () => {
    let r = await run(["accounts", "describe"], dir);
    const lines = r.stdout.split("\n");
    const name = lines.filter((l) => {
      return l.includes("Name");
    });
    assertEquals(name.length, 1);
    name[0] = name[0].replace(/\s+/g, " ");
    assertEquals(name[0], "| Name | A |");
  });

  await t.step("delete", async () => {
    let r = await run(["accounts", "delete", "AA"], dir);
    assertStringIncludes(r.stderr, `[ OK ] expired account "AA"`);
  });

  await t.step("edit", async () => {
    let r = await run(["accounts", "edit", "--expiry", "1y"], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] changed jwt expiry to ${new Date().getUTCFullYear() + 1}`,
    );

    let k = createAccount();
    r = await run(["accounts", "edit", "--sk", k.getPublicKey()], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] added signing key "${k.getPublicKey()}"`,
    );

    r = await run(["accounts", "edit", "--rm-sk", k.getPublicKey()], dir);
    assertStringIncludes(
      r.stderr,
      `[ OK ] removed signing key "${k.getPublicKey()}"`,
    );

    r = await run(["accounts", "edit", "--disallow-bearer", "true"], dir);
    assertStringIncludes(r.stderr, `[ OK ] changed disallow bearer to true`);

    r = await run(["accounts", "edit", "--disallow-bearer", "false"], dir);
    assertStringIncludes(r.stderr, `[ OK ] changed disallow bearer to false`);
  });
});

Deno.test("users", async (t) => {
  const dir = await Deno.makeTempDir();
  await run(["operator", "add", "O"], dir);
  await run(["accounts", "add", "A"], dir);

  await t.step("list - empty", async () => {
    const { code, stderr } = await run(["users", "list"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, "No entries defined");
  });

  await t.step("add", async () => {
    const { code, stderr } = await run(["users", "add", "U"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored user key "U');
  });

  await t.step("add again", async () => {
    const { code, stderr } = await run(["users", "add", "UU"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, '[ OK ] generated and stored user key "U');
  });

  await t.step("list", async () => {
    const { code, stderr } = await run(["users", "list"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, "| U    | U");
    assertStringIncludes(stderr, "| UU   | U");
  });

  await t.step("delete", async () => {
    const { code, stderr } = await run(["users", "delete", "UU"], dir);
    assertEquals(code, 0);
    assertStringIncludes(stderr, "[ OK ] revoked user");
    assertStringIncludes(stderr, "[ OK ] user deleted");
  });

  await t.step("get", async () => {
    const { code, stdout } = await run(
      ["users", "get", "--json"],
      dir,
    );
    assertEquals(code, 0);
    const o = JSON.parse(stdout);
    assertEquals(o.name, "U");
    assertEquals(o.nats.type, "user");
  });

  await t.step("save to file", async () => {
    const fp = join(dir, "get-out.jwt");
    const { code } = await run(
      ["users", "get", "--out", fp],
      dir,
    );
    assertEquals(code, 0);
    const raw = Deno.readTextFileSync(fp);
    assertStringIncludes(raw, "-----BEGIN NATS USER JWT-----");
    assertStringIncludes(raw, "------END NATS USER JWT------");
    const lines = raw.split("\n");
    const uc = decode<ClaimsData<User>>(lines[1]);
    assertEquals(uc.name, "U");
    assertEquals(uc.nats.type, "user");
  });

  await t.step("describe", async () => {
    let r = await run(["users", "describe", "U"], dir);
    const lines = r.stdout.split("\n");
    const name = lines.filter((l) => {
      return l.includes("Name");
    });
    assertEquals(name.length, 1);
    name[0] = name[0].replace(/\s+/g, " ");
    assertEquals(name[0], "| Name | U |");
  });

  await t.step("allow-perm", async () => {
    let r = await run(["users", "allow-perm", "U", "--pub", "foo"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added pub "foo"`);

    r = await run(["users", "allow-perm", "U", "--sub", "bar"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added sub "bar"`);

    r = await run(["users", "allow-perm", "U", "--pubsub", "baz"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added sub "baz"`);
    assertStringIncludes(r.stderr, `[ OK ] added pub "baz"`);

    r = await run(["users", "allow-perm", "U", "--respond", "1"], dir);
    assertStringIncludes(r.stderr, `[ OK ] set max responses to 1`);
  });

  await t.step("deny-perm", async () => {
    let r = await run(["users", "deny-perm", "U", "--pub", "foo"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added deny pub "foo"`);

    r = await run(["users", "deny-perm", "U", "--sub", "bar"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added deny sub "bar"`);

    r = await run(["users", "deny-perm", "U", "--pubsub", "baz"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added deny sub "baz"`);
    assertStringIncludes(r.stderr, `[ OK ] added deny pub "baz"`);
  });

  await t.step("remove-perm", async () => {
    let r = await run(["users", "allow-perm", "U", "--sub", "foo"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added sub "foo"`);

    r = await run(["users", "allow-perm", "U", "--pub", "bar"], dir);
    assertStringIncludes(r.stderr, `[ OK ] added pub "bar"`);

    r = await run(["users", "remove-perm", "U", "--rm", "foo,bar"], dir);
    assertStringIncludes(r.stderr, `[ OK ] removed sub "foo"`);
    assertStringIncludes(r.stderr, `[ OK ] removed pub "bar"`);

    await run(["users", "allow-pub", "U", "--respond"], dir);

    r = await run(["users", "remove-perm", "U", "--rm-respond"], dir);
    assertStringIncludes(r.stderr, `[ OK ] removed response permissions`);
  });

  await t.step("creds", async () => {
    const fp = join(dir, "U.creds");
    let r = await run(["users", "creds", "U", "--out", fp], dir);
    assertStringIncludes(r.stderr, `[ OK ] wrote credentials to`);

    const creds = await parseCreds(Deno.readFileSync(fp));
    assertEquals(creds.uc.name, "U");
  });
});
