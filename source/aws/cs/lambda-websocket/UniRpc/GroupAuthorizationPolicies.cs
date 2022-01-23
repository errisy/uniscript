namespace UniRpc
{
    public static partial class Static
    {
        public static IGroupPolicySet ServiceUserGroups = new IGroupPolicySet() { };

        public static IGroupPolicySet TesterUserGroups = new IGroupPolicySet() { };

        public static IPolicySets __PolicySets = new IPolicySets() {
            { "ServiceUserGroups", ServiceUserGroups },
            { "TesterUserGroups", TesterUserGroups }
        };
    }
}